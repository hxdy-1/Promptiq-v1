import { LoaderFive } from "@/components/ui/loader";

export default function Loading() {
	return (
		<div className="flex flex-col h-full justify-center items-center">
			<LoaderFive text="Loading your conversation…" />
		</div>
	);
}
