/**
 * 左栏 AI 对话面板：预设指令 + 消息列表 + 流式气泡 + 输入区
 * 受控于 useAiChat 返回的 controller，消费 AiChatAdapter 数据单元
 */
import {
	DeleteOutlined,
	RobotOutlined,
	SendOutlined,
	StopOutlined,
} from "@ant-design/icons";
import { Alert, Button, Input, Tooltip, Typography } from "antd";
import { useState } from "react";
import { CHAT_INPUT_PLACEHOLDER, PRESET_PROMPTS } from "../constants";
import type { AiChatController } from "../hooks/useAiChat";
import type { ChatTurn } from "../types";
import { MarkdownContent } from "./MarkdownContent";
import { ThinkingBubble } from "./ThinkingBubble";

const { Text } = Typography;

interface ChatPanelProps {
	controller: AiChatController;
	/** 将代码块应用到编辑器 */
	onApplyHtml: (html: string) => void;
}

/** 渲染一条 assistant 消息（含流式中的占位与思考气泡） */
function AssistantMessage({
	content,
	thinking,
	streaming = false,
	onApplyHtml,
}: {
	content: string;
	thinking?: string;
	streaming?: boolean;
	onApplyHtml: (html: string) => void;
}) {
	return (
		<div className="flex gap-2">
			<div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-fg">
				<RobotOutlined className="text-xs" />
			</div>
			<div className="min-w-0 flex-1 overflow-hidden rounded-md border border-border bg-background-secondary px-3 py-2">
				<ThinkingBubble thinking={thinking ?? ""} streaming={streaming} />
				<MarkdownContent content={content} onApplyHtml={onApplyHtml} />
			</div>
		</div>
	);
}

/** 渲染一条用户消息（右对齐气泡） */
function UserMessage({ content }: { content: string }) {
	return (
		<div className="flex justify-end">
			<div className="max-w-[85%] rounded-md bg-primary px-3 py-2 text-sm text-primary-fg">
				<span className="whitespace-pre-wrap break-words">{content}</span>
			</div>
		</div>
	);
}

export function ChatPanel({ controller, onApplyHtml }: ChatPanelProps) {
	const [input, setInput] = useState("");
	const {
		messages,
		streamText,
		thinkingText,
		isStreaming,
		error,
		send,
		stop,
		clear,
	} = controller;

	const handleSend = async (text?: string) => {
		const prompt = (text ?? input).trim();
		if (!prompt || isStreaming) return;
		await send(prompt);
		if (!text) setInput("");
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		// 中文输入法组合态不触发发送
		if ((e.nativeEvent as KeyboardEvent).isComposing) return;
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			void handleSend();
		}
	};

	return (
		<div className="flex h-full flex-col bg-background">
			{/* 预设指令 */}
			<div className="flex shrink-0 flex-wrap gap-1.5 border-b border-border p-2">
				{PRESET_PROMPTS.map((preset) => (
					<Button
						key={preset}
						size="small"
						disabled={isStreaming}
						onClick={() => void handleSend(preset)}
					>
						{preset}
					</Button>
				))}
			</div>

			{/* 消息列表 */}
			<div className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
				{messages.length === 0 && !streamText && (
					<div className="flex h-full items-center justify-center">
						<Text type="secondary" className="px-4 text-center text-sm">
							输入需求，或点击上方指令，让 AI 生成 HTML 页面
						</Text>
					</div>
				)}
				{messages.map((message: ChatTurn, index) =>
					message.role === "user" ? (
						<UserMessage key={index} content={message.content} />
					) : (
						<AssistantMessage
							key={index}
							content={message.content}
							thinking={message.thinking}
							onApplyHtml={(html) => onApplyHtml(html)}
						/>
					),
				)}
				{/* 流式回复占位 */}
				{(isStreaming || streamText) && (
					<AssistantMessage
						content={streamText || "…"}
						thinking={thinkingText}
						streaming
						onApplyHtml={onApplyHtml}
					/>
				)}
				{error && (
					<Alert type="error" showIcon message={error} className="text-sm" />
				)}
			</div>

			{/* 输入区 */}
			<div className="shrink-0 border-t border-border p-2">
				<Input.TextArea
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={CHAT_INPUT_PLACEHOLDER}
					autoSize={{ minRows: 2, maxRows: 6 }}
					disabled={isStreaming}
				/>
				<div className="mt-2 flex items-center justify-between gap-2">
					<Tooltip title="清空对话">
						<Button
							size="small"
							icon={<DeleteOutlined />}
							disabled={messages.length === 0 || isStreaming}
							onClick={clear}
						/>
					</Tooltip>
					<Text type="secondary" className="text-xs">
						Enter 发送，Shift+Enter 换行
					</Text>
					{isStreaming ? (
						<Button size="small" danger icon={<StopOutlined />} onClick={stop}>
							停止
						</Button>
					) : (
						<Button
							size="small"
							type="primary"
							icon={<SendOutlined />}
							disabled={!input.trim()}
							onClick={() => void handleSend()}
						>
							发送
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
