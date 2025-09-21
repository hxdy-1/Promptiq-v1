import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ChatPageClient from "@/components/chat/chat-client";

export default async function ChatPage() {
	const session = await getServerSession(authOptions);

	if (!session) {
		redirect("/auth");
	}

	return <ChatPageClient />;
}
