"use client";

import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MenuIcon, PlusIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { createThread } from "@/lib/actions/create-thread";
import Link from "next/link";

interface Thread {
	id: string;
	title: string | null;
}

interface SidebarProps {
	threads: Thread[];
}

export default function Sidebar({ threads }: SidebarProps) {
	const [collapsed, setCollapsed] = useState(false);
	const router = useRouter();
	const pathname = usePathname();
	const [isPending, startTransition] = useTransition();

	return (
		<aside
			className={cn(
				"bg-muted p-4 transition-all duration-200 overflow-y-auto border-r",
				collapsed ? "w-[60px]" : "w-[260px]"
			)}
		>
			<div className="flex justify-start items-center mb-4 gap-6">
				<Button
					variant="ghost"
					size="icon"
					onClick={() => setCollapsed(!collapsed)}
				>
					<MenuIcon className="h-5 w-5" />
				</Button>
				{!collapsed && (
					<h2 className="text-xl font-semibold">Threads</h2>
				)}
			</div>

			<Button
				variant="outline"
				className="w-full mb-4"
				disabled={isPending}
				onClick={() =>
					startTransition(async () => {
						try {
							const newThreadId = await createThread();
							router.push(`/chat/${newThreadId}`);
						} catch (err) {
							console.error("Failed to create thread", err);
						}
					})
				}
			>
				<PlusIcon className="h-4 w-4 mr-2" />
				{!collapsed && (isPending ? "Creating..." : "New Thread")}
			</Button>

			<div className="space-y-2 flex flex-col">
				{threads.map((thread) => (
					<Link
						href={`/chat/${thread.id}`}
						key={thread.id}
						prefetch={true}
					>
						<Button
							variant={
								pathname.includes(thread.id)
									? "default"
									: "ghost"
							}
							className="w-full justify-start"
						>
							{!collapsed
								? thread.title || "Untitled"
								: (thread.title || "U")[0]}
						</Button>
					</Link>
				))}
			</div>
		</aside>
	);
}
