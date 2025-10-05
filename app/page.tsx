"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function HomePage() {
	const router = useRouter();

	return (
		<main className="min-h-screen flex items-center justify-center p-6 bg-background">
			<section className="text-center max-w-2xl space-y-6">
				<h1 className="text-5xl font-bold tracking-tight leading-tight">
					Promptiq.chat
				</h1>
				<p className="text-lg text-muted-foreground">
					Chat with multiple AI models in one place. It's Fast.
					Minimal. & Powerful. <br />
					<span className="text-sm text-blue-400">
						One interface. Multiple models. Smarter conversations!
					</span>
				</p>
				<div className="flex flex-col sm:flex-row justify-center gap-4">
					<Button size="lg" onClick={() => router.push("/chat")}>
						Start Chat
					</Button>
					<Button
						size="lg"
						variant="outline"
						onClick={() => router.push("/auth")}
					>
						Sign In
					</Button>
				</div>
			</section>
		</main>
	);
}
