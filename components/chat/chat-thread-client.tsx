"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
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
import { ArrowDownIcon, ArrowDownNarrowWideIcon } from "lucide-react";

interface ChatMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
	model: string | null;
}

interface ChatThreadClientProps {
	thread: { id: string; title: string };
	initialMessages: ChatMessage[];
	currentUserFirstName: string | null | undefined;
}

type SendPayload = { content: string; model: string };

/**
 * Child: Uncontrolled textarea + model select.
 * Keeps its own small state (hasValue + selectedModel) so typing doesn't re-render parent.
 */
const ChatInputUncontrolled = React.memo(function ChatInputUncontrolled({
	onSend,
	onStop,
	isSending,
	defaultModel,
	availableModels,
}: {
	onSend: (payload: SendPayload) => void;
	onStop: () => void;
	isSending: boolean;
	defaultModel: string;
	availableModels: string[];
}) {
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const [hasValue, setHasValue] = useState(false);
	const [selectedModel, setSelectedModel] = useState<string>(defaultModel);

	useEffect(() => {
		// Keep child-model in sync if parent sends a different default later
		setSelectedModel(defaultModel);
	}, [defaultModel]);

	const handleInput = () => {
		const v = textareaRef.current?.value ?? "";
		setHasValue(Boolean(v.trim()));
	};

	const handleSend = () => {
		const val = textareaRef.current?.value ?? "";
		if (!val.trim() || isSending) return;

		// send to parent
		onSend({ content: val, model: selectedModel });

		// clear UI (uncontrolled)
		if (textareaRef.current) {
			textareaRef.current.value = "";
			textareaRef.current.focus();
		}
		setHasValue(false);
	};

	const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter") {
			if (e.shiftKey) {
				// Allow newline (don’t preventDefault)
				return;
			}
			// Enter without Shift → send
			if (!isSending) {
				e.preventDefault();
				handleSend();
			}
		}
	};

	return (
		<div className="bg-white p-4">
			<div className="relative flex flex-col sm:flex-row gap-2 items-end sm:items-start">
				<Textarea
					defaultValue=""
					placeholder="Ask literally anything! But legal :)"
					className="flex-1 resize-none pb-16 px-4 min-h-32 max-h-48 md:text-base shadow-md"
					name="prompt-input"
					ref={textareaRef}
					onInput={handleInput}
					onKeyDown={onKeyDown}
					rows={1}
				/>

				<div className="flex w-[97%] gap-2 absolute bottom-0.5 left-1/2 -translate-x-1/2 justify-between p-2 md:p-3 md:pl-0 bg-white">
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

					{!isSending ? (
						<Button
							onClick={handleSend}
							disabled={isSending || !hasValue}
						>
							Send
						</Button>
					) : (
						<Button variant="destructive" onClick={onStop}>
							Stop
						</Button>
					)}
				</div>
			</div>
		</div>
	);
});

export default function ChatThreadClient({
	thread,
	initialMessages,
	currentUserFirstName,
}: ChatThreadClientProps) {
	const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
	const [isSending, setIsSending] = useState(false);

	const availableModels = [
		"openai/gpt-oss-20b:free",
		"google/gemini-2.0-flash-exp:free",
		"qwen/qwen3-8b:free",
		"meta-llama/llama-4-maverick:free",
		"moonshotai/kimi-dev-72b:free",
	];

	const defaultModel = "openai/gpt-oss-20b:free";

	const maybeLastModel =
		initialMessages.length > 0
			? initialMessages[initialMessages.length - 1].model
			: null;

	const lastSelectedModel =
		maybeLastModel && availableModels.includes(maybeLastModel)
			? maybeLastModel
			: defaultModel;

	const { containerRef, bottomRef, isAtBottom, scrollToBottom } =
		useAutoScrollWithButton();

	const abortControllerRef = useRef<AbortController | null>(null);
	const tokenBufferRef = useRef<string>("");
	const flushTimeoutRef = useRef<number | null>(null);

	useEffect(() => {
		if (isAtBottom) scrollToBottom();
	}, [messages, isAtBottom, scrollToBottom]);
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

	// Handler called by child component
	const handleSendFromChild = useCallback(
		async ({ content, model }: SendPayload) => {
			if (!content.trim()) return;

			const userMessage: ChatMessage = {
				id: crypto.randomUUID(),
				role: "user",
				content,
				model,
			};

			const assistantPlaceholder: ChatMessage = {
				id: crypto.randomUUID(),
				role: "assistant",
				content: "",
				model,
			};

			// optimistic UI
			setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
			setIsSending(true);

			// save user message (fire-and-forget)
			fetch("/api/messages", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					content: userMessage.content,
					threadId: thread.id,
					role: "user",
					model: userMessage.model,
				}),
			}).catch((err) =>
				console.error("Failed to save user message:", err)
			);

			const controller = new AbortController();
			abortControllerRef.current = controller;

			try {
				// build conversation history from the current messages snapshot
				const conversationHistory = [...messages, userMessage].map(
					(m) => ({
						role: m.role,
						content: m.content,
					})
				);

				const res = await fetch("/api/chat/stream", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						model,
						messages: conversationHistory,
						threadId: thread.id,
					}),
					signal: controller.signal,
				});

				// If non-OK: read full body (text/json) and show that as assistant's message
				if (!res.ok) {
					console.error(
						"Non-OK response from /api/chat/stream",
						res.status,
						res.statusText
					);
					let errorMsg =
						"❌ Failed to generate response. Please try again.";
					try {
						const text = await res.text();
						try {
							const parsed = JSON.parse(text);
							if (parsed?.error?.message) {
								errorMsg = `❌ ${parsed.error.message}`;
							} else if (parsed?.message) {
								errorMsg = `❌ ${parsed.message}`;
							} else {
								errorMsg = `❌ ${JSON.stringify(parsed)}`;
							}
						} catch {
							if (text) errorMsg = `❌ ${text}`;
						}
					} catch (readErr) {
						console.error("Failed to read error body:", readErr);
					}

					setMessages((prev) =>
						prev.map((m) =>
							m.id === assistantPlaceholder.id
								? { ...m, content: errorMsg }
								: m
						)
					);

					// cleanup and stop
					setIsSending(false);
					abortControllerRef.current = null;
					if (flushTimeoutRef.current) {
						window.clearTimeout(flushTimeoutRef.current);
						flushTimeoutRef.current = null;
					}
					tokenBufferRef.current = "";
					return;
				}

				// If OK but no body (shouldn't normally happen for streaming endpoint)
				if (!res.body) {
					const text = await res.text().catch(() => "");
					const errorMsg = text
						? `❌ ${text}`
						: "❌ Server did not return a stream.";
					setMessages((prev) =>
						prev.map((m) =>
							m.id === assistantPlaceholder.id
								? { ...m, content: errorMsg }
								: m
						)
					);
					setIsSending(false);
					abortControllerRef.current = null;
					tokenBufferRef.current = "";
					return;
				}

				// Stream reading + parsing
				const reader = res.body.getReader();
				const decoder = new TextDecoder();
				let assistantText = "";
				let actualModel = model;

				const parser = createParser({
					onEvent: (event: EventSourceMessage) => {
						if (event.data === "[DONE]") return;
						try {
							const parsed = JSON.parse(event.data);

							if (parsed?.model && actualModel === model) {
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
							// ignore parse errors for SSE events
						}
					},
					onError: (err: ParseError) => {
						console.error("Parser error:", err);
					},
				});

				// Read loop
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					const chunk = decoder.decode(value, { stream: true });

					// Quick attempt: the server might return a JSON error as the first chunk (not SSE).
					// Try to detect a short JSON error payload and handle it immediately.
					try {
						const trimmed = chunk.trim();
						if (trimmed.startsWith("{") && trimmed.length < 20000) {
							const maybeJson = JSON.parse(trimmed);
							if (
								maybeJson?.error?.message ||
								maybeJson?.message
							) {
								const errText =
									maybeJson?.error?.message ??
									maybeJson?.message ??
									JSON.stringify(maybeJson);
								const errorMsg = `❌ ${errText}`;
								setMessages((prev) =>
									prev.map((m) =>
										m.id === assistantPlaceholder.id
											? { ...m, content: errorMsg }
											: m
									)
								);
								// stop consuming further and exit
								reader.cancel().catch(() => {});
								setIsSending(false);
								abortControllerRef.current = null;
								tokenBufferRef.current = "";
								return;
							}
						}
					} catch {
						// not a plain JSON error chunk — continue normal SSE parsing
					}

					// feed parser for normal SSE stream
					parser.feed(chunk);
				}

				// Flush buffer (any remainder)
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

				// Set final assistant text
				setMessages((prev) =>
					prev.map((m) =>
						m.id === assistantPlaceholder.id
							? { ...m, content: assistantText }
							: m
					)
				);

				// Persist assistant message (fire-and-forget)
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

				if (err?.name === "AbortError") {
					const partial = tokenBufferRef.current || "";
					setMessages((prev) =>
						prev.map((m) =>
							m.id === assistantPlaceholder.id
								? {
										...m,
										content:
											(m.content || "") +
											partial +
											"\n\n_(stopped by user 🫵)_ ",
								  }
								: m
						)
					);
				} else {
					// If fetch/res.body threw earlier than the explicit checks, try to show the error message if available
					let errorMsg =
						"❌ Failed to generate response, please try again. If it keeps on failing switch to a different model";
					try {
						// sometimes err contains a response-like body or message
						if (err?.message) errorMsg = `❌ ${err.message}`;
					} catch {}
					setMessages((prev) =>
						prev.map((m) =>
							m.id === assistantPlaceholder.id
								? { ...m, content: errorMsg }
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
		},
		// NOTE: messages is used to build conversationHistory. If you see stale history,
		// consider storing a ref to messages and reading messagesRef.current here instead.
		[messages, thread.id]
	);

	const handleStop = () => {
		abortControllerRef.current?.abort();
	};

	return (
		<main className="flex flex-col h-dvh justify-between">
			<header className="p-4 border-b bg-white">
				<h1 className="text-xl font-semibold">{thread.title}</h1>
			</header>

			<article
				ref={containerRef}
				className="overflow-y-auto px-[10%] py-12 space-y-4 h-full"
			>
				{messages?.length > 0 ? (
					messages.map((msg) => (
						<div
							key={msg.id}
							className={`p-3 rounded-lg whitespace-pre-wrap ${
								msg.role === "user"
									? "bg-gray-100 w-3/5 ml-auto mb-8"
									: "bg-white w-full"
							}`}
						>
							<MarkdownRenderer
								role={msg.role}
								content={msg.content || "_Thinking..._"}
							/>
						</div>
					))
				) : currentUserFirstName ? (
					<div className="flex flex-col h-full justify-center items-center">
						<h2 className="text-4xl font-semibold text-blue-400 text-shadow-blue-400">
							Hi {currentUserFirstName}, how can I help you today?
						</h2>
					</div>
				) : (
					<div className="flex flex-col h-full justify-center items-center">
						<h2 className="text-4xl font-semibold text-blue-400 text-shadow-blue-400">
							Hey there! Ready when you are.
						</h2>
					</div>
				)}
				<div ref={bottomRef}></div>
			</article>

			<footer className="relative bg-white mx-auto w-full md:w-5xl max-h-1/2 max-w-5xl">
				{!isAtBottom && (
					<button
						onClick={() => scrollToBottom()}
						className="absolute left-1/2 bottom-[105%] -translate-x-1/2 z-50 p-2 rounded-full border border-stone-600 bg-black text-white shadow-md hover:bg-gray-800 transition "
					>
						<ArrowDownIcon size={16} />
					</button>
				)}
				<ChatInputUncontrolled
					onSend={handleSendFromChild}
					onStop={handleStop}
					isSending={isSending}
					defaultModel={lastSelectedModel}
					availableModels={availableModels}
				/>
			</footer>
		</main>
	);
}
