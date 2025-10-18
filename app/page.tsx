"use client";

import { FlipWords } from "@/components/ui/flip-words";
import { HoverBorderGradient } from "@/components/ui/hover-border-gradient";
import { LoaderFive } from "@/components/ui/loader";
import { SparklesCore } from "@/components/ui/sparkles";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function HomePage() {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState<boolean>(false);

	const heroFlipWords = ["Modern.", "Efficient.", "Minimal.", "Dynamic."];

	return (
		<main className="min-h-dvh flex items-center justify-end md:justify-center p-6 bg-background">
			<section className="text-center max-w-7xl space-y-6">
				<div className="h-auto w-full bg-transparent flex flex-col items-center justify-center overflow-hidden rounded-md">
					<h1 className="md:text-7xl text-4xl lg:text-9xl font-bold text-center text-black relative z-20">
						Promptiq.chat
					</h1>
					<div className="w-full h-40 relative">
						{/* Gradients */}
						<div className="absolute inset-x-20 top-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent h-[2px] w-3/4 blur-sm" />
						<div className="absolute inset-x-20 top-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent h-px w-3/4" />
						<div className="absolute inset-x-60 top-0 bg-gradient-to-r from-transparent via-sky-500 to-transparent h-[5px] w-1/4 blur-sm" />
						<div className="absolute inset-x-60 top-0 bg-gradient-to-r from-transparent via-sky-500 to-transparent h-px w-1/4" />

						{/* Core component */}
						<SparklesCore
							background="#FFFFFF"
							minSize={0.4}
							maxSize={1}
							particleDensity={1200}
							className="w-full h-full"
							particleColor="#000000"
						/>

						{/* Radial Gradient to prevent sharp edges */}
						<div className="absolute inset-0 w-full h-full bg-white [mask-image:radial-gradient(350px_200px_at_top,transparent_20%,white)]"></div>
					</div>
				</div>
				<div className="flex flex-col gap-4 absolute left-1/2 -translate-x-1/2 w-full px-2 md:px-8 md:translate-0 md:static">
					<div className="text-sm md:text-lg text-muted-foreground md:text-left md:mx-auto">
						Chat with multiple AI models in one place. It's
						<FlipWords words={heroFlipWords} />
						<p className="text-xs md:text-sm text-sky-500 text-center">
							One interface. Multiple models. Smarter
							conversations!
						</p>
					</div>
					<div className="flex flex-col sm:flex-row justify-center items-center gap-4">
						<HoverBorderGradient
							onClick={() => {
								router.push("/chat");
								setIsLoading(true);
							}}
							containerClassName="rounded-full"
							as="button"
							aria-disabled={isLoading}
							className="font-semibold dark:bg-black bg-white text-black dark:text-white flex items-center space-x-2 disabled:cursor-not-allowed"
						>
							{!isLoading ? (
								<div className="flex items-center gap-2">
									<TerminalIcon className="mt-1" />
									<span>Start the chat</span>
								</div>
							) : (
								<LoaderFive text="Starting the chat..." />
							)}
						</HoverBorderGradient>
					</div>
				</div>
			</section>
		</main>
	);
}

const TerminalIcon = ({ className }: { className: string }) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 512 512"
		width={20}
		height={20}
		fill="none"
		className={className}
	>
		<rect x={32} y={48} width={448} height={352} rx={24} fill="black" />
		<path
			d="M320 48H152l24 24h168a24 24 0 0 1 24 24v8H56V72a24 24 0 0 1 24-24h240z"
			fill="black"
		/>
		<circle cx={88} cy={88} r={12} fill="white" />
		<circle cx={128} cy={88} r={12} fill="white" />
		<path
			d="M120 240a12 12 0 0 1 17 2l48 36a12 12 0 0 1 0 18l-48 36a12 12 0 1 1 -15-20l37-27-37-27a12 12 0 0 1 -2-17z"
			fill="white"
		/>
		<rect x={240} y={290} width={144} height={24} rx={12} fill="white" />
	</svg>
);
