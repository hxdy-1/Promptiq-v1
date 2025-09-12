"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import MarkdownRenderer from "./markdown-renderer";
import {
	createParser,
	type EventSourceMessage,
	type ParseError,
} from "eventsource-parser";
import { useAutoScrollWithButton } from "@/hooks/useAutoScrollWithButton";

interface ChatMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
}

interface ChatThreadClientProps {
	thread: { id: string; title: string };
	initialMessages: ChatMessage[];
	currentUserEmail: string;
}

export default function ChatThreadClient({
	thread,
	initialMessages,
	currentUserEmail,
}: ChatThreadClientProps) {
	const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
	const [input, setInput] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [selectedModel, setSelectedModel] = useState(
		"openai/gpt-oss-20b:free"
	);

	const { containerRef, bottomRef, isAtBottom, scrollToBottom } =
		useAutoScrollWithButton();

	const abortControllerRef = useRef<AbortController | null>(null);
	const tokenBufferRef = useRef<string>("");
	const flushTimeoutRef = useRef<number | null>(null);

	useEffect(() => {
		if (isAtBottom) scrollToBottom();
	}, [messages]);

	const availableModels = [
		"openai/gpt-oss-20b:free",
		"moonshotai/kimi-k2:free",
		"qwen/qwen3-4b:free",
		"deepseek/deepseek-r1:free",
	];

	const scheduleFlush = (assistantId: string) => {
		if (flushTimeoutRef.current) return;
		flushTimeoutRef.current = window.setTimeout(() => {
			const toFlush = tokenBufferRef.current;
			tokenBufferRef.current = "";
			setMessages((prev) =>
				prev.map((m) =>
					m.id === assistantId
						? { ...m, content: (m.content || "") + toFlush }
						: m
				)
			);
			flushTimeoutRef.current = null;
		}, 80);
	};

	const handleSend = async () => {
		if (!input.trim()) return;

		const userMessage: ChatMessage = {
			id: crypto.randomUUID(),
			role: "user",
			content: input,
		};

		const assistantPlaceholder: ChatMessage = {
			id: crypto.randomUUID(),
			role: "assistant",
			content: "",
		};

		setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
		setInput("");
		setIsSending(true);

		fetch("/api/messages", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				content: userMessage.content,
				threadId: thread.id,
				role: "user",
				model: selectedModel,
			}),
		}).catch((err) => console.error("Failed to save user message:", err));

		const controller = new AbortController();
		abortControllerRef.current = controller;

		try {
			// Building the full conversation/chats history INCLUDING the new user message in the current thread.
			const conversationHistory = [...messages, userMessage].map((m) => ({
				role: m.role,
				content: m.content,
			}));

			const res = await fetch("/api/chat/stream", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					model: selectedModel,
					messages: conversationHistory,
					threadId: thread.id,
				}),
				signal: controller.signal,
			});

			if (!res.ok || !res.body) {
				throw new Error("Stream error");
			}

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let assistantText = "";
			let actualModel = selectedModel; // default to requested model

			const parser = createParser({
				onEvent: (event: EventSourceMessage) => {
					if (event.data === "[DONE]") return;
					try {
						const parsed = JSON.parse(event.data);

						// Capture actual model from the first message that includes it
						if (parsed?.model && actualModel === selectedModel) {
							actualModel = parsed.model;
						}

						const delta =
							parsed?.choices?.[0]?.delta?.content ??
							parsed?.choices?.[0]?.delta ??
							"";
						if (delta) {
							tokenBufferRef.current += delta;
							scheduleFlush(assistantPlaceholder.id);
							assistantText += delta;
						}
					} catch {
						// ignore parse errors
					}
				},
				onError: (err: ParseError) => {
					console.error("Parser error:", err);
				},
			});

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				parser.feed(decoder.decode(value, { stream: true }));
			}

			// Flush buffer
			if (tokenBufferRef.current) {
				const rem = tokenBufferRef.current;
				tokenBufferRef.current = "";
				setMessages((prev) =>
					prev.map((m) =>
						m.id === assistantPlaceholder.id
							? { ...m, content: (m.content || "") + rem }
							: m
					)
				);
			}

			setMessages((prev) =>
				prev.map((m) =>
					m.id === assistantPlaceholder.id
						? { ...m, content: assistantText }
						: m
				)
			);

			fetch("/api/messages", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					content: assistantText,
					threadId: thread.id,
					role: "assistant",
					model: actualModel,
				}),
			}).catch((err) =>
				console.error("Failed to save assistant message:", err)
			);
		} catch (err: any) {
			console.error("Streaming failed:", err);
			if (err.name === "AbortError") {
				const partial = tokenBufferRef.current || "";
				setMessages((prev) =>
					prev.map((m) =>
						m.id === assistantPlaceholder.id
							? {
									...m,
									content:
										(m.content || "") +
										partial +
										"\n\n_(stopped by user)_ ",
							  }
							: m
					)
				);
			} else {
				setMessages((prev) =>
					prev.map((m) =>
						m.id === assistantPlaceholder.id
							? {
									...m,
									content: "❌ Failed to generate response.",
							  }
							: m
					)
				);
			}
		} finally {
			setIsSending(false);
			abortControllerRef.current = null;
			if (flushTimeoutRef.current) {
				window.clearTimeout(flushTimeoutRef.current);
				flushTimeoutRef.current = null;
			}
			tokenBufferRef.current = "";
		}
	};

	const handleStop = () => {
		abortControllerRef.current?.abort();
	};

	return (
		<main className="relative flex flex-col h-dvh justify-between">
			<header className="p-4 border-b bg-white">
				<h1 className="text-xl font-bold">{thread.title}</h1>
			</header>
			<article
				ref={containerRef}
				className="overflow-y-auto px-[10%] py-12 space-y-4 h-full"
			>
				{messages.map((msg) => (
					<div
						key={msg.id}
						className={`p-3 rounded-lg whitespace-pre-wrap ${
							msg.role === "user"
								? "bg-gray-100 w-3/5 ml-auto mb-8"
								: "bg-white w-full"
						}`}
					>
						<MarkdownRenderer
							content={msg.content || "_Thinking..._"}
						/>
					</div>
				))}
				<div ref={bottomRef}></div>
			</article>

			{!isAtBottom && (
				<button
					onClick={() => scrollToBottom()}
					className="absolute left-1/2 bottom-1/4 -translate-x-1/2 z-50 p-2 rounded-full border border-stone-600 bg-black text-white shadow-md hover:bg-gray-800 transition "
				>
					<svg
						width="20"
						height="20"
						viewBox="0 0 20 20"
						fill="currentColor"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path d="M9.33468 3.33333C9.33468 2.96617 9.6326 2.66847 9.99972 2.66829C10.367 2.66829 10.6648 2.96606 10.6648 3.33333V15.0609L15.363 10.3626L15.4675 10.2777C15.7255 10.1074 16.0762 10.1357 16.3034 10.3626C16.5631 10.6223 16.5631 11.0443 16.3034 11.304L10.4704 17.137C10.2108 17.3967 9.7897 17.3966 9.52999 17.137L3.69601 11.304L3.61105 11.1995C3.44054 10.9414 3.46874 10.5899 3.69601 10.3626C3.92328 10.1354 4.27479 10.1072 4.53292 10.2777L4.63741 10.3626L9.33468 15.0599V3.33333Z"></path>
					</svg>
				</button>
			)}

			<footer className="border-t bg-white p-4">
				<div className="flex flex-col sm:flex-row gap-2 items-end sm:items-center">
					<Select
						value={selectedModel}
						onValueChange={setSelectedModel}
					>
						<SelectTrigger className="w-full sm:w-[240px]">
							<SelectValue placeholder="Select a model" />
						</SelectTrigger>
						<SelectContent>
							{availableModels.map((m) => (
								<SelectItem key={m} value={m}>
									{m}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Textarea
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="Type your message..."
						className="flex-1 min-h-[60px] resize-none"
					/>
					<div className="flex gap-2">
						<Button
							onClick={handleSend}
							disabled={isSending || !input.trim()}
						>
							Send
						</Button>
						{isSending && (
							<Button variant="destructive" onClick={handleStop}>
								Stop
							</Button>
						)}
					</div>
				</div>
			</footer>
		</main>
	);
}

// "use client";

// import { useState, useRef, useEffect } from "react";
// import { Button } from "@/components/ui/button";
// import { Textarea } from "@/components/ui/textarea";
// import {
// 	Select,
// 	SelectContent,
// 	SelectItem,
// 	SelectTrigger,
// 	SelectValue,
// } from "@/components/ui/select";
// import MarkdownRenderer from "./markdown-renderer";
// import {
// 	createParser,
// 	type EventSourceMessage,
// 	type ParseError,
// } from "eventsource-parser";
// import { useAutoScrollWithButton } from "@/hooks/useAutoScrollWithButton";
// import { useThread } from "@/hooks/useThread";

// interface ChatMessage {
// 	id: string;
// 	role: "user" | "assistant";
// 	content: string;
// }

// interface ChatThreadClientProps {
// 	thread: { id: string; title: string };
// 	initialMessages: ChatMessage[];
// 	currentUserEmail: string;
// }

// export default function ChatThreadClient({
// 	thread,
// 	initialMessages,
// 	currentUserEmail,
// }: ChatThreadClientProps) {
// 	// Local-first hook: reads from IndexedDB then refreshes from server.
// 	const fetchServerThread = async (): Promise<{
// 		thread: {
// 			id: string;
// 			title: string;
// 			userId: string;
// 			updatedAt: string;
// 		};
// 		messages: {
// 			id: string;
// 			threadId: string;
// 			userId: string;
// 			role: "user" | "assistant";
// 			content: string;
// 			model?: string | null;
// 			createdAt: string;
// 		}[];
// 	}> => {
// 		try {
// 			const res = await fetch(`/api/threads/${thread.id}`);
// 			if (!res.ok) {
// 				// fallback if thread not found on server
// 				return {
// 					thread: {
// 						id: thread.id,
// 						title: thread.title,
// 						userId: "unknown",
// 						updatedAt: new Date().toISOString(),
// 					},
// 					messages: [],
// 				};
// 			}

// 			const data = await res.json();

// 			return {
// 				thread: {
// 					id: data.thread.id,
// 					title: data.thread.title,
// 					userId: data.thread.userId,
// 					updatedAt: data.thread.updatedAt,
// 				},
// 				messages: data.messages.map((m: any) => ({
// 					id: m.id,
// 					threadId: m.threadId,
// 					userId: m.userId,
// 					role: m.role,
// 					content: m.content ?? "",
// 					model: m.model ?? null,
// 					createdAt: m.createdAt,
// 				})),
// 			};
// 		} catch (err) {
// 			console.error("fetchServerThread error", err);
// 			// fallback in case of error
// 			return {
// 				thread: {
// 					id: thread.id,
// 					title: thread.title,
// 					userId: "unknown",
// 					updatedAt: new Date().toISOString(),
// 				},
// 				messages: [],
// 			};
// 		}
// 	};

// 	const {
// 		thread: localThread,
// 		messages: localMessages,
// 		loading,
// 	} = useThread(thread.id, fetchServerThread);

// 	// useState initialised with server-side initialMessages for SSR fallback
// 	const [messages, setMessages] = useState<ChatMessage[]>(
// 		initialMessages ?? []
// 	);

// 	// Sync localMessages (from IndexedDB) into state once available
// 	useEffect(() => {
// 		if (!loading && Array.isArray(localMessages)) {
// 			if (localMessages.length > 0) {
// 				const mapped = localMessages.map((m) => ({
// 					id: m.id,
// 					role: m.role,
// 					content: m.content ?? "",
// 				}));
// 				setMessages(mapped);
// 			}
// 			// If localMessages is empty we keep initialMessages (no overwriting)
// 		}
// 		// eslint-disable-next-line react-hooks/exhaustive-deps
// 	}, [localMessages, loading]);

// 	// other UI state
// 	const [input, setInput] = useState("");
// 	const [isSending, setIsSending] = useState(false);
// 	const [selectedModel, setSelectedModel] = useState(
// 		"openai/gpt-oss-20b:free"
// 	);

// 	const { containerRef, bottomRef, isAtBottom, scrollToBottom } =
// 		useAutoScrollWithButton();

// 	// streaming helpers
// 	const abortControllerRef = useRef<AbortController | null>(null);
// 	const tokenBufferRef = useRef<string>("");
// 	const flushTimeoutRef = useRef<number | null>(null);

// 	useEffect(() => {
// 		if (isAtBottom) scrollToBottom();
// 		// we want to scroll when messages change
// 		// eslint-disable-next-line react-hooks/exhaustive-deps
// 	}, [messages]);

// 	const availableModels = [
// 		"openai/gpt-oss-20b:free",
// 		"moonshotai/kimi-k2:free",
// 		"qwen/qwen3-4b:free",
// 		"deepseek/deepseek-r1:free",
// 	];

// 	// flush buffered tokens to the assistant placeholder periodically
// 	const scheduleFlush = (assistantId: string) => {
// 		if (flushTimeoutRef.current) return;
// 		flushTimeoutRef.current = window.setTimeout(() => {
// 			const toFlush = tokenBufferRef.current;
// 			tokenBufferRef.current = "";
// 			setMessages((prev) =>
// 				prev.map((m) =>
// 					m.id === assistantId
// 						? { ...m, content: (m.content || "") + toFlush }
// 						: m
// 				)
// 			);
// 			flushTimeoutRef.current = null;
// 		}, 80);
// 	};

// 	// handle send with streaming — largely kept from your original implementation
// 	const handleSend = async () => {
// 		if (!input.trim()) return;

// 		const userMessage: ChatMessage = {
// 			id: crypto.randomUUID(),
// 			role: "user",
// 			content: input,
// 		};

// 		const assistantPlaceholder: ChatMessage = {
// 			id: crypto.randomUUID(),
// 			role: "assistant",
// 			content: "",
// 		};

// 		// Optimistically update UI
// 		setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
// 		setInput("");
// 		setIsSending(true);

// 		// Persist user message in background (non-blocking)
// 		fetch("/api/messages", {
// 			method: "POST",
// 			headers: { "Content-Type": "application/json" },
// 			body: JSON.stringify({
// 				content: userMessage.content,
// 				threadId: thread.id,
// 				role: "user",
// 				model: selectedModel,
// 			}),
// 		}).catch((err) => console.error("Failed to save user message:", err));

// 		const controller = new AbortController();
// 		abortControllerRef.current = controller;

// 		try {
// 			// Build conversation history using current messages state + new user message
// 			const conversationHistory = [...messages, userMessage].map((m) => ({
// 				role: m.role,
// 				content: m.content,
// 			}));

// 			const res = await fetch("/api/chat/stream", {
// 				method: "POST",
// 				headers: { "Content-Type": "application/json" },
// 				body: JSON.stringify({
// 					model: selectedModel,
// 					messages: conversationHistory,
// 					threadId: thread.id,
// 				}),
// 				signal: controller.signal,
// 			});

// 			if (!res.ok || !res.body) {
// 				throw new Error("Stream error");
// 			}

// 			const reader = res.body.getReader();
// 			const decoder = new TextDecoder();
// 			let assistantText = "";
// 			let actualModel = selectedModel;

// 			const parser = createParser({
// 				onEvent: (event: EventSourceMessage) => {
// 					if (event.data === "[DONE]") return;
// 					try {
// 						const parsed = JSON.parse(event.data);

// 						if (parsed?.model && actualModel === selectedModel) {
// 							actualModel = parsed.model;
// 						}

// 						const delta =
// 							parsed?.choices?.[0]?.delta?.content ??
// 							parsed?.choices?.[0]?.delta ??
// 							"";
// 						if (delta) {
// 							tokenBufferRef.current += delta;
// 							scheduleFlush(assistantPlaceholder.id);
// 							assistantText += delta;
// 						}
// 					} catch {
// 						// ignore parse errors
// 					}
// 				},
// 				onError: (err: ParseError) => {
// 					console.error("Parser error:", err);
// 				},
// 			});

// 			while (true) {
// 				const { done, value } = await reader.read();
// 				if (done) break;
// 				parser.feed(decoder.decode(value, { stream: true }));
// 			}

// 			// final flush of any remaining tokens
// 			if (tokenBufferRef.current) {
// 				const rem = tokenBufferRef.current;
// 				tokenBufferRef.current = "";
// 				setMessages((prev) =>
// 					prev.map((m) =>
// 						m.id === assistantPlaceholder.id
// 							? { ...m, content: (m.content || "") + rem }
// 							: m
// 					)
// 				);
// 			}

// 			// set the assistant final content
// 			setMessages((prev) =>
// 				prev.map((m) =>
// 					m.id === assistantPlaceholder.id
// 						? { ...m, content: assistantText }
// 						: m
// 				)
// 			);

// 			// persist assistant final message to server
// 			fetch("/api/messages", {
// 				method: "POST",
// 				headers: { "Content-Type": "application/json" },
// 				body: JSON.stringify({
// 					content: assistantText,
// 					threadId: thread.id,
// 					role: "assistant",
// 					model: actualModel,
// 				}),
// 			}).catch((err) =>
// 				console.error("Failed to save assistant message:", err)
// 			);
// 		} catch (err: any) {
// 			console.error("Streaming failed:", err);
// 			if (err.name === "AbortError") {
// 				const partial = tokenBufferRef.current || "";
// 				setMessages((prev) =>
// 					prev.map((m) =>
// 						m.id === assistantPlaceholder.id
// 							? {
// 									...m,
// 									content:
// 										(m.content || "") +
// 										partial +
// 										"\n\n_(stopped by user)_ ",
// 							  }
// 							: m
// 					)
// 				);
// 			} else {
// 				setMessages((prev) =>
// 					prev.map((m) =>
// 						m.id === assistantPlaceholder.id
// 							? {
// 									...m,
// 									content: "❌ Failed to generate response.",
// 							  }
// 							: m
// 					)
// 				);
// 			}
// 		} finally {
// 			setIsSending(false);
// 			abortControllerRef.current = null;
// 			if (flushTimeoutRef.current) {
// 				window.clearTimeout(flushTimeoutRef.current);
// 				flushTimeoutRef.current = null;
// 			}
// 			tokenBufferRef.current = "";
// 		}
// 	};

// 	const handleStop = () => {
// 		abortControllerRef.current?.abort();
// 	};

// 	return (
// 		<main className="relative flex flex-col h-dvh justify-between">
// 			<header className="p-4 border-b bg-white">
// 				<h1 className="text-xl font-bold">
// 					{localThread?.title ?? thread.title}
// 				</h1>
// 			</header>

// 			<article
// 				ref={containerRef}
// 				className="overflow-y-auto px-[10%] py-12 space-y-4 h-full"
// 			>
// 				{messages.map((msg) => (
// 					<div
// 						key={msg.id}
// 						className={`p-3 rounded-lg whitespace-pre-wrap ${
// 							msg.role === "user"
// 								? "bg-gray-100 w-3/5 ml-auto mb-8"
// 								: "bg-white w-full"
// 						}`}
// 					>
// 						<MarkdownRenderer
// 							content={msg.content || "_Thinking..._"}
// 						/>
// 					</div>
// 				))}

// 				<div ref={bottomRef}></div>
// 			</article>

// 			{!isAtBottom && (
// 				<button
// 					onClick={() => scrollToBottom()}
// 					className="absolute left-1/2 bottom-1/4 -translate-x-1/2 z-50 p-2 rounded-full border border-stone-600 bg-black text-white shadow-md hover:bg-gray-800 transition "
// 				>
// 					<svg
// 						width="20"
// 						height="20"
// 						viewBox="0 0 20 20"
// 						fill="currentColor"
// 						xmlns="http://www.w3.org/2000/svg"
// 					>
// 						<path d="M9.33468 3.33333C9.33468 2.96617 9.6326 2.66847 9.99972 2.66829C10.367 2.66829 10.6648 2.96606 10.6648 3.33333V15.0609L15.363 10.3626L15.4675 10.2777C15.7255 10.1074 16.0762 10.1357 16.3034 10.3626C16.5631 10.6223 16.5631 11.0443 16.3034 11.304L10.4704 17.137C10.2108 17.3967 9.7897 17.3966 9.52999 17.137L3.69601 11.304L3.61105 11.1995C3.44054 10.9414 3.46874 10.5899 3.69601 10.3626C3.92328 10.1354 4.27479 10.1072 4.53292 10.2777L4.63741 10.3626L9.33468 15.0599V3.33333Z"></path>
// 					</svg>
// 				</button>
// 			)}

// 			<footer className="border-t bg-white p-4">
// 				<div className="flex flex-col sm:flex-row gap-2 items-end sm:items-center">
// 					<Select
// 						value={selectedModel}
// 						onValueChange={setSelectedModel}
// 					>
// 						<SelectTrigger className="w-full sm:w-[240px]">
// 							<SelectValue placeholder="Select a model" />
// 						</SelectTrigger>
// 						<SelectContent>
// 							{availableModels.map((m) => (
// 								<SelectItem key={m} value={m}>
// 									{m}
// 								</SelectItem>
// 							))}
// 						</SelectContent>
// 					</Select>
// 					<Textarea
// 						value={input}
// 						onChange={(e) => setInput(e.target.value)}
// 						placeholder="Type your message..."
// 						className="flex-1 min-h-[60px] resize-none"
// 					/>
// 					<div className="flex gap-2">
// 						<Button
// 							onClick={handleSend}
// 							disabled={isSending || !input.trim()}
// 						>
// 							Send
// 						</Button>
// 						{isSending && (
// 							<Button variant="destructive" onClick={handleStop}>
// 								Stop
// 							</Button>
// 						)}
// 					</div>
// 				</div>
// 			</footer>
// 		</main>
// 	);
// }
