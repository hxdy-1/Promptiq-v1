"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signOut } from "next-auth/react";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ChatPageClient() {
	const [messages, setMessages] = useState<
		{ id: number; role: "user" | "ai"; content: string }[]
	>([]);

	const [input, setInput] = useState("");

	const handleSend = () => {
		if (!input.trim()) return;

		const userMessage = {
			id: Date.now(),
			role: "user" as const,
			content: input,
		};

		const aiMessage = {
			id: Date.now() + 1,
			role: "ai" as const,
			content: "This is a placeholder response from the AI.",
		};

		setMessages((prev) => [...prev, userMessage, aiMessage]);
		setInput("");
	};

	return (
		<main className="flex flex-col h-screen p-6">
			{/* Header */}
			<header className="flex justify-between items-center mb-4">
				<h1 className="text-2xl font-bold">Your Chat</h1>
				<Button onClick={() => signOut({ callbackUrl: "/" })}>
					Logout
				</Button>
			</header>

			{/* Chat area */}
			<ScrollArea className="flex-1 bg-muted rounded-md p-4 mb-4 space-y-3 overflow-y-auto">
				{messages.map((msg) => (
					<div
						key={msg.id}
						className={`p-3 rounded-md max-w-md ${
							msg.role === "user"
								? "bg-primary text-primary-foreground ml-auto"
								: "bg-popover text-popover-foreground"
						}`}
					>
						{msg.content}
					</div>
				))}
			</ScrollArea>

			{/* Input area */}
			<form
				onSubmit={(e) => {
					e.preventDefault();
					handleSend();
				}}
				className="flex gap-2"
			>
				<Input
					value={input}
					onChange={(e) => setInput(e.target.value)}
					placeholder="Type your message..."
					className="flex-1"
				/>
				<Button type="submit">Send</Button>
			</form>
		</main>
	);
}
