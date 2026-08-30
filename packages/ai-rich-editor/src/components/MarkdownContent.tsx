/**
 * AI 对话消息的轻量渲染：文本分块 + ```html 代码块
 * 不做完整 markdown 解析：代码块整体展示并可一键应用，其余按段落输出
 */

import { CodeOutlined } from "@ant-design/icons";
import { Button, Tooltip, Typography } from "antd";

const { Paragraph, Text } = Typography;

/** 解析后的内容块 */
type ContentBlock =
	| { kind: "text"; text: string }
	| { kind: "code"; html: string };

/** 将文本按 markdown 围栏拆分为文本块与 HTML 代码块 */
export function splitContentBlocks(content: string): ContentBlock[] {
	const blocks: ContentBlock[] = [];
	const fenceRegex = /```(?:html)?\s*\n([\s\S]*?)```/g;
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

interface MarkdownContentProps {
	content: string;
	/** 点击「应用到编辑器」回调（传入代码块内容） */
	onApplyHtml?: (html: string) => void;
}

export function MarkdownContent({
	content,
	onApplyHtml,
}: MarkdownContentProps) {
	const blocks = splitContentBlocks(content);
	if (blocks.length === 0) {
		return <Text type="secondary">(空回复)</Text>;
	}
	return (
		<div className="space-y-2">
			{blocks.map((block, index) =>
				block.kind === "text" ? (
					<Paragraph
						key={index}
						className="!mb-0 whitespace-pre-wrap text-sm"
						style={{ whiteSpace: "pre-wrap" }}
					>
						{block.text}
					</Paragraph>
				) : (
					<div
						key={index}
						className="overflow-hidden rounded border border-border"
					>
						<div className="flex items-center justify-between gap-2 border-b border-border bg-background-secondary px-2 py-1">
							<Text className="flex items-center gap-1 text-xs text-muted-foreground">
								<CodeOutlined /> HTML
							</Text>
							{onApplyHtml && (
								<Tooltip title="替换编辑器中的内容">
									<Button
										size="small"
										type="link"
										onClick={() => onApplyHtml(block.html)}
									>
										应用到编辑器
									</Button>
								</Tooltip>
							)}
						</div>
						<pre className="max-h-60 overflow-auto bg-background-secondary p-2 text-xs leading-relaxed">
							<code>{block.html}</code>
						</pre>
					</div>
				),
			)}
		</div>
	);
}
