import { relations } from "drizzle-orm";
import {
	pgTable,
	uuid,
	text,
	varchar,
	integer,
	timestamp,
	pgEnum,
} from "drizzle-orm/pg-core";

export const userType = pgEnum("user_type", ["normal", "pro"]);

export const users = pgTable("users", {
	id: uuid("id").primaryKey().defaultRandom(),
	email: varchar("email", { length: 255 }).notNull().unique(),
	name: varchar("name", { length: 255 }),
	image: text("image"),
	type: userType("type").default("normal").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const threads = pgTable("threads", {
	id: uuid("id").primaryKey().defaultRandom(),
	userId: uuid("user_id")
		.references(() => users.id)
		.notNull(),
	title: text("title"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const messages = pgTable("messages", {
	id: uuid("id").primaryKey().defaultRandom(),
	threadId: uuid("thread_id")
		.references(() => threads.id)
		.notNull(),
	userId: uuid("user_id")
		.references(() => users.id)
		.notNull(),
	role: text("role").$type<"user" | "assistant">().notNull(),
	content: text("content").notNull(),
	model: varchar("model", { length: 255 }),
	inputTokens: integer("input_tokens"),
	outputTokens: integer("output_tokens"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// --- Relations ---
export const usersRelations = relations(users, ({ many }) => ({
	threads: many(threads),
	messages: many(messages),
}));

export const threadsRelations = relations(threads, ({ one, many }) => ({
	user: one(users, {
		fields: [threads.userId],
		references: [users.id],
	}),
	messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
	user: one(users, {
		fields: [messages.userId],
		references: [users.id],
	}),
	thread: one(threads, {
		fields: [messages.threadId],
		references: [threads.id],
	}),
}));
