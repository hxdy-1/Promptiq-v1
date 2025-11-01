import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/db/client";
import { messages, users } from "@/db/schema";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
	const session = await getServerSession(authOptions);
	if (!session?.user?.email) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const body = await req.json();
	const { content, threadId, model, role, inputTokens, outputTokens } = body;

	if (!content || !threadId || !model || !role) {
		return NextResponse.json({ error: "Missing fields" }, { status: 400 });
	}

	const validRoles = ["user", "assistant", "system"];
	if (!validRoles.includes(role)) {
		return NextResponse.json({ error: "Invalid role" }, { status: 400 });
	}

	const [user] = await db
		.select()
		.from(users)
		.where(eq(users.email, session.user.email));

	if (!user) {
		return NextResponse.json({ error: "User not found" }, { status: 404 });
	}

	const messageId = uuid();
	const createdAt = new Date();

	const safeInputTokens =
		typeof inputTokens === "number"
			? Math.max(0, Math.trunc(inputTokens))
			: null;
	const safeOutputTokens =
		typeof outputTokens === "number"
			? Math.max(0, Math.trunc(outputTokens))
			: null;

	await db.insert(messages).values({
		id: messageId,
		content,
		role,
		threadId,
		model,
		userId: user.id,
		inputTokens: safeInputTokens,
		outputTokens: safeOutputTokens,
		createdAt,
	});

	return NextResponse.json({
		message: {
			id: messageId,
			content,
			role,
			model,
			inputTokens: safeInputTokens,
			outputTokens: safeOutputTokens,
			createdAt,
		},
	});
}
