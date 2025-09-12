import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";

interface MarkdownRendererProps {
	content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
	return (
		// <div
		// 	className="
		//     prose-lg max-w-none text-left
		//     prose-p:my-2 prose-pre:my-2 prose-h1:my-3 prose-h2:my-3 prose-h3:my-2
		//     prose-hr:my-4
		//     prose-ul:list-disc prose-ol:list-decimal prose-ul:pl-6 prose-ol:pl-6
		//     prose-li:my-0 prose-li:p-0
		//     prose-li>p:my-0
		//   "
		// >
		<div
			className="
		    prose prose-pink max-w-none dark:prose-invert prose-pre:m-0 prose-pre:bg-transparent prose-pre:p-0 prose-p:m-0
		  "
		>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				rehypePlugins={[rehypeHighlight]}
				components={{
					li: ({ children }) => <li className="my-1">{children}</li>,
				}}
			>
				{content}
			</ReactMarkdown>
		</div>
	);
}
