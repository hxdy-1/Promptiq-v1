import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect, notFound } from "next/navigation";
import ChatThreadClient from "@/components/chat/chat-thread-client";
import { db } from "@/db/client";
import { threads, messages } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

interface ChatMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
}

export default async function ChatThreadPage({
	params,
}: {
	params: { threadId: string };
}) {
	const session = await getServerSession(authOptions);
	if (!session?.user?.email || !session?.user?.id) {
		redirect("/auth");
	}

	const { threadId } = await params;

	const thread = await db.query.threads.findFirst({
		where: eq(threads.id, threadId),
	});

	if (!thread || thread.userId !== session.user.id) {
		notFound();
	}

	const dbMessages = await db.query.messages.findMany({
		where: eq(messages.threadId, thread.id),
		orderBy: [desc(messages.createdAt)],
	});

	const formattedMessages: ChatMessage[] = dbMessages.reverse().map((m) => ({
		id: m.id,
		role: m.role,
		content: m.content,
	}));

	return (
		<ChatThreadClient
			thread={{
				id: thread.id,
				title: thread.title ?? "Untitled Thread X",
			}}
			initialMessages={formattedMessages}
			currentUserEmail={session.user.email}
		/>
	);
}
