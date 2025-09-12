import Dexie, { Table } from "dexie";

export interface LocalThread {
	id: string; // UUID
	userId: string;
	title: string | null;
	updatedAt: string; // ISO
	lastMessagePreview?: string;
}

export interface LocalMessage {
	id: string;
	threadId: string;
	userId: string;
	role: "user" | "assistant";
	content: string;
	model?: string | null;
	isStreaming?: boolean; // temporary while streaming
	createdAt: string; // ISO
	savedToServer?: boolean; // mark if persisted
}

class LocalDB extends Dexie {
	threads!: Table<LocalThread, string>;
	messages!: Table<LocalMessage, string>;

	constructor() {
		super("promptiq_localdb");
		this.version(1).stores({
			threads: "id, userId, updatedAt",
			messages: "id, threadId, createdAt, role",
		});
	}
}

export const dbLocal = new LocalDB();

// helper: get all messages for a thread in order
export const getMessagesForThread = (threadId: string) =>
	dbLocal.messages.where("threadId").equals(threadId).sortBy("createdAt");
