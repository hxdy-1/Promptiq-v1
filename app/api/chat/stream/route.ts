import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { db } from "@/db/client";
import { threads } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { messages, model, threadId } = body ?? {};

		if (!Array.isArray(messages) || !model || !threadId) {
			return new NextResponse(
				"Bad request: missing messages, model, or threadId",
				{ status: 400 }
			);
		}

		// Authenticate user
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return new NextResponse("Unauthorized", { status: 401 });
		}

		// Verify thread ownership: make sure this thread belongs to the current user
		const thread = await db.query.threads.findFirst({
			where: eq(threads.id, threadId),
			columns: { id: true, userId: true },
		});

		if (!thread || thread.userId !== session.user.id) {
			return new NextResponse("Not found or unauthorized thread", {
				status: 404,
			});
		}

		// Proxy to OpenRouter
		const OR_URL = "https://openrouter.ai/api/v1/chat/completions";

		const orRes = await fetch(OR_URL, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model,
				messages,
				stream: true,
			}),
		});

		if (!orRes.ok) {
			const text = await orRes.text();
			return new NextResponse(text, { status: orRes.status });
		}

		// Pass back the streaming body as-is. Set SSE headers.
		const headers = new Headers({
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
		});

		return new NextResponse(orRes.body, { status: 200, headers });
	} catch (err) {
		console.error("Stream route error:", err);
		return new NextResponse("Internal Server Error", { status: 500 });
	}
}
