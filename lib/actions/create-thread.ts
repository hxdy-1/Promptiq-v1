"use server";

import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { db } from "@/db/client";
import { threads } from "@/db/schema";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
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

	// Create new thread
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
