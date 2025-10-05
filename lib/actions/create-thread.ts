"use server";

import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { db } from "@/db/client";
import { threads, users, messages } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function createThread(revalidatePaths: boolean) {
	const session = await getServerSession(authOptions);
	if (!session?.user?.email) {
		throw new Error("Unauthorized");
	}

	// Find user
	const user = await db.query.users.findFirst({
		where: eq(users.email, session.user.email),
	});
	if (!user) {
		throw new Error("User not found");
	}

	// Get the user's last thread (latest created)
	const [lastThread] = await db
		.select()
		.from(threads)
		.where(eq(threads.userId, user.id))
		.orderBy(desc(threads.createdAt))
		.limit(1);

	if (lastThread) {
		// Check if it's empty (no messages) OR has default title
		const msgs = await db
			.select()
			.from(messages)
			.where(eq(messages.threadId, lastThread.id))
			.limit(1);

		const isEmpty = msgs.length === 0;

		if (isEmpty) {
			return lastThread.id; // reuse it
		}
	}

	// Otherwise, create a new thread
	const [newThread] = await db
		.insert(threads)
		.values({
			userId: user.id,
			title: "New Thread",
		})
		.returning();

	// revalidate paths using threads
	if (revalidatePaths) {
		revalidatePath("/chat");
	}

	return newThread.id;
}
