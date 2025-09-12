import { useState, useEffect, useRef, useCallback } from "react";

interface UseAutoScrollWithButtonReturn {
	containerRef: React.RefObject<HTMLDivElement | null>;
	bottomRef: React.RefObject<HTMLDivElement | null>;
	isAtBottom: boolean;
	scrollToBottom: (smooth?: boolean) => void;
}

export function useAutoScrollWithButton(): UseAutoScrollWithButtonReturn {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const bottomRef = useRef<HTMLDivElement | null>(null);
	const [isAtBottom, setIsAtBottom] = useState(true);

	const scrollToBottom = useCallback((smooth = true) => {
		bottomRef.current?.scrollIntoView({
			behavior: smooth ? "smooth" : "auto",
			block: "end",
		});
	}, []);

	// Track scroll position
	const handleScroll = useCallback(() => {
		const el = containerRef.current;
		if (!el) return;
		const threshold = 50;
		setIsAtBottom(
			el.scrollTop + el.clientHeight >= el.scrollHeight - threshold
		);
	}, []);

	// Attach scroll listener
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		el.addEventListener("scroll", handleScroll);
		return () => {
			el.removeEventListener("scroll", handleScroll);
		};
	}, [handleScroll]);

	// Auto-scroll when new messages arrive
	useEffect(() => {
		if (isAtBottom) scrollToBottom();
	}, [isAtBottom, scrollToBottom]);

	return { containerRef, bottomRef, isAtBottom, scrollToBottom };
}
