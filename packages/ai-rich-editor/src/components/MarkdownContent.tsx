/**
 * AI 对话消息渲染：markdown 富文本 + ```html 代码块
 * 助手消息走 react-markdown（标题/加粗/行内代码/列表/引用），
 * ```html 代码块单独渲染为「可复制/应用到编辑器」卡片；其余代码块走 markdown 默认样式。
 */

import { CodeOutlined, CopyOutlined } from "@ant-design/icons";
import { Button, Tooltip, Typography } from "antd";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { AiRichNotify } from "../types";

const { Text } = Typography;

/** 解析后的内容块 */
type ContentBlock =
	| { kind: "text"; text: string }
	| { kind: "code"; html: string };

/** 将文本按 ```html 围栏拆分为文本块与 HTML 代码块（其余语言的围栏块交由 markdown 渲染） */
export function splitContentBlocks(content: string): ContentBlock[] {
	const blocks: ContentBlock[] = [];
	const fenceRegex = /```html\s*\n([\s\S]*?)```/g;
	let lastIndex = 0;
	for (
		let match = fenceRegex.exec(content);
		match;
		match = fenceRegex.exec(content)
	) {
		const before = content.slice(lastIndex, match.index).trim();
		if (before) blocks.push({ kind: "text", text: before });
		const fragment = match[1].trim();
		if (fragment) blocks.push({ kind: "code", html: fragment });
		lastIndex = match.index + match[0].length;
	}
	const tail = content.slice(lastIndex).trim();
	if (tail) blocks.push({ kind: "text", text: tail });
	return blocks;
}

/** markdown 渲染组件（Doubao 风格：正文深色、行内代码浅色圆角块、标题加粗、引用左侧竖线） */
const mdComponents: Components = {
	p: ({ children }) => (
		<p className="mb-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground last:mb-0">
			{children}
		</p>
	),
	h1: ({ children }) => (
		<h1 className="mb-2 text-lg font-semibold text-foreground last:mb-0">
			{children}
		</h1>
	),
	h2: ({ children }) => (
		<h2 className="mb-2 text-base font-semibold text-foreground last:mb-0">
			{children}
		</h2>
	),
	h3: ({ children }) => (
		<h3 className="mb-2 text-sm font-semibold text-foreground last:mb-0">
			{children}
		</h3>
	),
	strong: ({ children }) => (
		<strong className="font-semibold text-foreground">{children}</strong>
	),
	a: ({ href, children }) => (
		<a href={href} className="text-primary underline underline-offset-2">
			{children}
		</a>
	),
	ul: ({ children }) => (
		<ul className="mb-2 ml-5 list-disc space-y-1 text-sm text-foreground last:mb-0">
			{children}
		</ul>
	),
	ol: ({ children }) => (
		<ol className="mb-2 ml-5 list-decimal space-y-1 text-sm text-foreground last:mb-0">
			{children}
		</ol>
	),
	li: ({ children }) => <li className="leading-relaxed">{children}</li>,
	blockquote: ({ children }) => (
		<blockquote className="my-2 border-l-2 border-accent pl-3 text-foreground-secondary last:mb-0">
			{children}
		</blockquote>
	),
	// 块级代码（带 language- 或含换行）→ 等宽块；行内代码（单行无换行）→ 浅灰圆角
	code: ({ className, children }) => {
		const text = Array.isArray(children)
			? children.join("")
			: String(children ?? "");
		const isBlock = Boolean(className) || text.includes("\n");
		return isBlock ? (
			<code className="block font-mono text-xs leading-6">{text}</code>
		) : (
			<code className="rounded bg-background-secondary px-1.5 py-0.5 font-mono text-[12.5px] text-foreground">
				{text}
			</code>
		);
	},
	pre: ({ children }) => (
		<pre className="my-2 overflow-x-auto rounded-xl border border-divider bg-background-secondary p-3 last:mb-0">
			{children}
		</pre>
	),
};

/** 展示文本块（markdown 渲染） */
function MarkdownText({ text }: { text: string }) {
	return (
		<ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
			{text}
		</ReactMarkdown>
	);
}

/** HTML 代码块：头部（标签 + 复制/应用）+ 可滚动正文 */
function CodeBlock({
	html,
	onApplyHtml,
	notify,
}: {
	html: string;
	onApplyHtml?: (html: string) => void;
	notify?: AiRichNotify;
}) {
	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(html);
			notify?.("success", "已复制代码");
		} catch {
			notify?.("error", "复制失败");
		}
	};

	return (
		<div className="overflow-hidden rounded-xl border border-divider">
			<div className="flex items-center justify-between gap-2 border-b border-divider bg-background px-3 py-1.5">
				<span className="flex items-center gap-1.5 text-xs text-foreground-secondary">
					<CodeOutlined /> HTML
				</span>
				<div className="flex items-center gap-1">
					<Tooltip title="复制代码">
						<Button
							size="small"
							type="text"
							icon={<CopyOutlined />}
							onClick={handleCopy}
							className="text-foreground-secondary"
						/>
					</Tooltip>
					{onApplyHtml && (
						<Tooltip title="替换编辑器中的内容">
							<Button
								size="small"
								type="link"
								onClick={() => onApplyHtml(html)}
							>
								应用到编辑器
							</Button>
						</Tooltip>
					)}
				</div>
			</div>
			<pre className="max-h-72 overflow-auto bg-background-secondary p-3 text-xs leading-6">
				<code className="font-mono text-foreground-secondary">{html}</code>
			</pre>
		</div>
	);
}

interface MarkdownContentProps {
	content: string;
	/** 点击「应用到编辑器」回调（传入代码块内容） */
	onApplyHtml?: (html: string) => void;
	/** 轻提示回调（复制代码等） */
	notify?: AiRichNotify;
}

export function MarkdownContent({
	content,
	onApplyHtml,
	notify,
}: MarkdownContentProps) {
	const blocks = splitContentBlocks(content);
	if (blocks.length === 0) {
		return <Text className="text-xs text-foreground-tertiary">(空回复)</Text>;
	}
	return (
		<div className="space-y-2">
			{blocks.map((block, index) =>
				block.kind === "text" ? (
					<MarkdownText key={index} text={block.text} />
				) : (
					<CodeBlock
						key={index}
						html={block.html}
						onApplyHtml={onApplyHtml}
						notify={notify}
					/>
				),
			)}
		</div>
	);
}
