import { useEffect, useState } from "react";
import {
	dbLocal,
	getMessagesForThread,
	LocalThread,
	LocalMessage,
} from "@/lib/localdb";

export function useThread(
	threadId: string,
	fetchServerThread: () => Promise<{
		thread: LocalThread;
		messages: LocalMessage[];
	}>
) {
	const [thread, setThread] = useState<LocalThread | null>(null);
	const [messages, setMessages] = useState<LocalMessage[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let mounted = true;

		async function loadLocal() {
			const t = await dbLocal.threads.get(threadId);
			const msgs = await getMessagesForThread(threadId);
			if (!mounted) return;
			setThread(t ?? null);
			setMessages(msgs);
			setLoading(false);
		}

		loadLocal();

		// Background refresh from server
		(async () => {
			try {
				const server = await fetchServerThread();
				if (!mounted) return;

				if (server?.thread) {
					// Update thread
					await dbLocal.threads.put(server.thread);

					// Upsert messages
					for (const m of server.messages) {
						await dbLocal.messages.put({
							...m,
							savedToServer: true,
							createdAt: new Date(m.createdAt).toISOString(),
						});
					}

					const freshMsgs = await getMessagesForThread(threadId);
					setThread(server.thread);
					setMessages(freshMsgs);
				}
			} catch (err) {
				console.error("refresh thread failed", err);
			}
		})();

		return () => {
			mounted = false;
		};
	}, [threadId, fetchServerThread]);

	return { thread, messages, loading };
}
