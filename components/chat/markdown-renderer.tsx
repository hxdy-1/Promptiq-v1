import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
// import "highlight.js/styles/github.css";
// import "highlight.js/styles/atom-one-dark.css";
// import "highlight.js/styles/vs2015.css"; // looks good
import "highlight.js/styles/github-dark.css"; // looks best

interface MarkdownRendererProps {
	content: any;
	role: "user" | "assistant";
}

export default function MarkdownRenderer({
	content,
	role,
}: MarkdownRendererProps) {
	if (role === "user") {
		// Plain text for user
		return (
			<div className="whitespace-pre-wrap overflow-x-auto">{content}</div>
		);
	}

	// Markdown for assistant
	return (
		<div
			className="
		    prose prose-blue max-w-none dark:prose-invert prose-pre:m-0 prose-pre:bg-transparent prose-hr:m-0 prose-pre:p-0 prose-p:m-0 prose-pre:px-0 prose-pre:rounded-xl prose-code:rounded-md prose-headings:m-0 prose-table:m-0 prose-table:mx-4 prose-ul:m-0 prose-ul:leading-[1] prose-ol:m-0 prose-ol:leading-[1] prose-li:m-0 prose-li:leading-normal prose-blockquote:border-none prose-blockquote:not-italic prose-blockquote:m-0
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
