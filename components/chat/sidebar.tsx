"use client";

import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LogOutIcon, MenuIcon, PlusIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { createThread } from "@/lib/actions/create-thread";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { LoaderFive } from "../ui/loader";

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

	// effect to set collapsed state based on screen width
	useEffect(() => {
		const mediaQuery = window.matchMedia("(max-width: 450px)");

		const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
			const isMobile = e.matches;
			console.log("isMobile", isMobile);
			setCollapsed(isMobile);
		};

		// Initial check
		handleChange(mediaQuery);

		// Watch for width changes only
		mediaQuery.addEventListener("change", handleChange);
		return () => mediaQuery.removeEventListener("change", handleChange);
	}, []);

	// auto-collapse on thread switch (mobile only)
	useEffect(() => {
		if (window.innerWidth <= 450) {
			setCollapsed(true);
		}
	}, [pathname]);

	return (
		<aside
			className={cn(
				"bg-gray-200/10 p-4 min-h-dvh h-dvh transition-all duration-200 border-r flex flex-col", // flex column layout
				collapsed
					? "w-[60px] md:w-[60px] px-3 relative"
					: "w-full md:w-[260px] static"
			)}
		>
			{/* Sticky top */}
			<div className="shrink-0">
				<div className="flex justify-start items-center mb-4 gap-6">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setCollapsed(!collapsed)}
					>
						<MenuIcon className="h-5 w-5" />
					</Button>
					{!collapsed && (
						<h2 className="text-xl font-bold mx-auto mr-[38%] md:mr-auto md:ml-0">
							Promptiq-v1
						</h2>
					)}
				</div>

				<Button
					variant="outline"
					className={
						"w-full mb-4 py-2 px-4 flex items-center justify-center gap-4"
					}
					disabled={isPending}
					onClick={() =>
						startTransition(async () => {
							try {
								const newThreadId = await createThread(true);
								router.push(`/chat/${newThreadId}`);
							} catch (err) {
								console.error("Failed to create thread", err);
							}
						})
					}
				>
					{!collapsed &&
						(isPending ? (
							<></>
						) : (
							<PlusIcon
								className={cn(
									"h-4 w-4",
									collapsed ? "ml-" : "-ml-6"
								)}
							/>
						))}
					{!collapsed &&
						(isPending ? (
							<LoaderFive text="Creating..." />
						) : (
							"New Thread"
						))}
				</Button>
			</div>

			{/* Scrollable middle */}
			<div
				className={cn(
					"flex-1 overflow-y-auto space-y-2 transition-all duration-300",
					collapsed ? "invisible" : "visible"
				)}
			>
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
							className={cn(
								"w-full flex justify-start",
								collapsed ? "justify-center" : "justify-start"
							)}
						>
							{!collapsed
								? thread.title || "Untitled"
								: (thread.title || "U")[0]}
						</Button>
					</Link>
				))}
			</div>

			{/* Sticky bottom */}
			<div
				className={cn(
					"shrink-0 mt-4",
					collapsed ? "absolute bottom-4" : "static"
				)}
			>
				<Button
					onClick={() => signOut({ callbackUrl: "/" })}
					className="w-full flex items-center gap-2"
					variant="secondary"
				>
					{collapsed ? (
						<LogOutIcon className="rotate-180" />
					) : (
						<span className="flex items-center gap-4">
							<LogOutIcon
								className={cn(
									"rotate-180",
									collapsed ? "ml-" : "-ml-8"
								)}
							/>
							Logout
						</span>
					)}
				</Button>
			</div>
		</aside>
	);
}
