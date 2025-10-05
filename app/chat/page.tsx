import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createThread } from "@/lib/actions/create-thread";

export default async function ChatPage() {
	const session = await getServerSession(authOptions);

	if (!session || !session?.user?.email) {
		redirect("/auth");
	}

	// Create a new thread
	const threadId = await createThread(false);

	// Redirect to that thread page
	redirect(`/chat/${threadId}`);
}
