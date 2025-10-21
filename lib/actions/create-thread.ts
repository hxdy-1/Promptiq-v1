"use server";

import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { db } from "@/db/client";
import { threads, users, messages } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { InferSelectModel } from "drizzle-orm";

type UserWithThread = InferSelectModel<typeof users> & {
	threads: InferSelectModel<typeof threads>[];
};

export async function createThread(revalidatePaths: boolean) {
	const session = await getServerSession(authOptions);
	if (!session?.user?.email) throw new Error("Unauthorized");

	// Single optimized query using drizzle SQL
	const userWithLastThread = (await db.query.users.findFirst({
		where: eq(users.email, session.user.email),
		with: {
			threads: {
				orderBy: desc(threads.createdAt),
				limit: 1,
				with: {
					messages: {
						limit: 1,
						columns: { id: true },
					},
				},
			},
		},
	})) as
		| (UserWithThread & {
				threads: (UserWithThread["threads"][0] & {
					messages: { id: string }[];
				})[];
		  })
		| undefined;

	if (!userWithLastThread) throw new Error("User not found");

	const lastThread = userWithLastThread.threads[0];
	const hasMessages = lastThread?.messages?.length > 0;

	if (lastThread && !hasMessages) {
		return lastThread.id;
	}

	const [newThread] = await db
		.insert(threads)
		.values({
			userId: userWithLastThread.id,
			title: "New Thread",
		})
		.returning({ id: threads.id });

	if (revalidatePaths) revalidatePath("/chat");

	return newThread.id;
}
