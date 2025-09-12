import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import { ReactNode } from "react";
import SidebarWrapper from "@/components/chat/sidebar-wrapper";

interface ChatLayoutProps {
	children: ReactNode;
}

export default async function ChatLayout({ children }: ChatLayoutProps) {
	const session = await getServerSession(authOptions);

	if (!session) {
		redirect("/auth");
	}

	return (
		<div className="flex h-screen">
			<SidebarWrapper />
			<main className="flex-1 overflow-y-auto">{children}</main>
		</div>
	);
}
