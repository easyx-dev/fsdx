/**
 * AI 思考内容气泡（reasoning）：默认收起，仅显示状态与字符数，展开可查看全文
 * 无思考内容时渲染 null；降级/无思考模型时由调用方传入空文本即可隐藏
 */
import { DownOutlined, RightOutlined } from "@ant-design/icons";
import { useState } from "react";

interface ThinkingBubbleProps {
	/** 思考全文（逐段累积）；为空则不渲染 */
	thinking: string;
	/** 是否仍在流式生成中（用于「思考中…」文案） */
	streaming?: boolean;
}

export function ThinkingBubble({
	thinking,
	streaming = false,
}: ThinkingBubbleProps) {
	const [expanded, setExpanded] = useState(false);
	if (!thinking.trim()) return null;

	return (
		<div className="mb-2 overflow-hidden rounded-2xl border border-divider bg-background-secondary">
			<button
				type="button"
				onClick={() => setExpanded((prev) => !prev)}
				className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-background"
			>
				<span className="text-xs text-foreground-secondary">
					{streaming ? "思考中…" : "已思考"}
				</span>
				<span className="text-xs text-foreground-tertiary">
					({thinking.length} 字)
				</span>
				<span className="ml-auto text-[10px] text-foreground-tertiary">
					{expanded ? <DownOutlined /> : <RightOutlined />}
				</span>
			</button>
			{expanded && (
				<div className="border-t border-divider px-3 py-2">
					<span className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground-secondary">
						{thinking}
					</span>
				</div>
			)}
		</div>
	);
}
