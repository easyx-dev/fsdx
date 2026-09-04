/**
 * AI 对话消息渲染：基于 @ant-design/x-markdown 的 XMarkdown
 * 助手消息全文走 XMarkdown（标题/加粗/行内代码/列表/表格/引用），
 * ```html 围栏代码块通过 components.code 拦截渲染为「可复制/应用到编辑器」卡片；
 * 其余代码块与行内代码由包内默认样式渲染。
 */
import { CodeOutlined, CopyOutlined } from "@ant-design/icons";
import type { ComponentProps } from "@ant-design/x-markdown";
import { XMarkdown } from "@ant-design/x-markdown";
import { Button, Tooltip, Typography } from "antd";
import { type ReactNode, useEffect, useRef } from "react";
import type { AiRichNotify } from "../types";

const { Text } = Typography;

/** HTML 代码块卡片：头部（标签 + 复制/应用）+ 可滚动正文 */
function HtmlCodeCard({
	html,
	onApplyHtml,
	notify,
}: {
	html: string;
	onApplyHtml?: (html: string) => void;
	notify?: AiRichNotify;
}) {
	const preRef = useRef<HTMLPreElement>(null);
	const isFirstRender = useRef(true);

	// 流式生成过程中内容持续增长，自动滚动到底部露出最新代码（跳过挂载首轮，避免完整代码块一出现就跳到底）
	useEffect(() => {
		if (isFirstRender.current) {
			isFirstRender.current = false;
			return;
		}
		const el = preRef.current;
		if (!el || !html) return;
		el.scrollTop = el.scrollHeight;
	}, [html]);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(html);
			notify?.("success", "已复制代码");
		} catch {
			notify?.("error", "复制失败");
		}
	};

	return (
		<div className="my-2 overflow-hidden rounded-xl border border-divider">
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
			<pre
				ref={preRef}
				className="overflow-auto bg-background-secondary p-4 text-xs leading-6"
				style={{ maxHeight: 288 }}
			>
				<code className="font-mono text-foreground-secondary">{html}</code>
			</pre>
		</div>
	);
}

/** 非 html 的块级代码：等宽滚动块；行内代码：浅灰圆角块 */
function DefaultCode({
	block,
	children,
}: {
	block: boolean;
	children: ReactNode;
}) {
	if (block) {
		return (
			<pre className="my-2 overflow-x-auto rounded-xl border border-divider bg-background-secondary p-3">
				<code className="block font-mono text-xs leading-6 text-foreground-secondary">
					{children}
				</code>
			</pre>
		);
	}
	return (
		<code className="rounded bg-background-secondary px-1.5 py-0.5 font-mono text-[12.5px] text-foreground">
			{children}
		</code>
	);
}

/** XMarkdown 组件映射：拦截 ```html 代码块渲染卡片，接管 pre/code 默认样式 */
function buildMarkdownComponents(
	onApplyHtml?: (html: string) => void,
	notify?: AiRichNotify,
) {
	return {
		// outer pre 仅作透传（块级代码的 pre 由 DefaultCode/card 自行渲染）
		pre: ({ children }: ComponentProps) => <>{children}</>,
		code: (props: ComponentProps) => {
			const { lang, block, children } = props;
			// lang / block 由 XMarkdown 对围栏代码注入（未知类型，做布尔/等值判定）；
			// 兼容 lang 带附加参数（如 ```html id="main"）的情况
			const isHtml =
				(block as boolean | undefined) === true &&
				typeof lang === "string" &&
				lang.startsWith("html");
			if (isHtml) {
				// XMarkdown 对围栏代码追加了结尾换行，展示时去掉
				const html = String(children ?? "").replace(/\n$/, "");
				return (
					<HtmlCodeCard html={html} onApplyHtml={onApplyHtml} notify={notify} />
				);
			}
			return <DefaultCode block={Boolean(block)}>{children}</DefaultCode>;
		},
	};
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
	if (!content.trim()) {
		return <Text className="text-xs text-foreground-tertiary">(空回复)</Text>;
	}
	return (
		<div className="text-foreground">
			<XMarkdown
				content={content}
				openLinksInNewTab
				disableDefaultStyles={["pre", "code"]}
				components={buildMarkdownComponents(onApplyHtml, notify)}
			/>
		</div>
	);
}
