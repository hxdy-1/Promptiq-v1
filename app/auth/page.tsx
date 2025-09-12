"use client";

import { useEffect } from "react";
import { useSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AuthPage() {
	const { data: session } = useSession();
	const router = useRouter();

	useEffect(() => {
		if (session?.user) {
			router.push("/chat");
		}
	}, [session, router]);

	return (
		<main className="min-h-screen flex items-center justify-center p-4">
			<Card className="w-full max-w-md shadow-lg">
				<CardHeader>
					<CardTitle className="text-center text-2xl">
						Welcome to Promptiq
					</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<p className="text-muted-foreground text-center">
						Sign in with your Google account to continue.
					</p>
					<Button
						onClick={() =>
							signIn("google", { callbackUrl: "/chat" })
						}
						variant="default"
						className="w-full"
					>
						Sign in with Google
					</Button>
				</CardContent>
			</Card>
		</main>
	);
}
