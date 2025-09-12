import { useRef, useState } from "react";
import {
	createParser,
	type EventSourceMessage,
	type ParseError,
} from "eventsource-parser";

export interface ChatMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
}

interface UseChatStreamProps {
	threadId: string;
	selectedModel: string;
}

export function useChatStream({ threadId, selectedModel }: UseChatStreamProps) {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [isSending, setIsSending] = useState(false);

	const abortControllerRef = useRef<AbortController | null>(null);
	const tokenBufferRef = useRef<string>("");
	const flushTimeoutRef = useRef<number | null>(null);

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

	const sendMessage = async (input: string) => {
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
		setIsSending(true);

		fetch("/api/messages", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				content: userMessage.content,
				threadId,
				role: "user",
				model: selectedModel,
			}),
		}).catch((err) => console.error("Failed to save user message:", err));

		const controller = new AbortController();
		abortControllerRef.current = controller;

		try {
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
					threadId,
				}),
				signal: controller.signal,
			});

			if (!res.ok || !res.body) throw new Error("Stream error");

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let assistantText = "";

			const parser = createParser({
				onEvent: (event: EventSourceMessage) => {
					if (event.data === "[DONE]") return;
					try {
						const parsed = JSON.parse(event.data);
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
				onError: (err: ParseError) =>
					console.error("Parser error:", err),
			});

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				parser.feed(decoder.decode(value, { stream: true }));
			}

			// Final flush
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
					threadId,
					role: "assistant",
					model: selectedModel,
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

	const stopMessage = () => {
		abortControllerRef.current?.abort();
	};

	return {
		messages,
		isSending,
		sendMessage,
		stopMessage,
		setMessages, // optional: if you want to preload messages
	};
}
