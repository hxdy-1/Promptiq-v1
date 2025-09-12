ALTER TABLE "chats" RENAME TO "messages";--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "chats_thread_id_threads_id_fk";
--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT "chats_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;