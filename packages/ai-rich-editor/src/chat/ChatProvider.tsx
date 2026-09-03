/**
 * AI 富编辑器对话区（headless UI）绑定
 * 基于 @tanstack/ai-react/ui 的 createChatHook：模块作用域注册一次，
 * components（layout/message/input）+ partsComponents（text/thinking/fallback）
 * 驱动消息渲染；宿主经 EditorCfgContext 注入 runtime 配置（systemPrompt/requestMeta/onApplyHtml/notify）。
 * 服务端仍由 /api/ai-chat 返回 TanStack 标准 SSE，fetchServerSentEvents 直接消费。
 *
 * 单实例假设：编辑器一页一个；createChatHook 的 options 在模块作用域固定，
 * 故 endpointUrl / onComplete 通过模块级 ref 由宿主导入。
 */
import {
	DeleteOutlined,
	RobotOutlined,
	SendOutlined,
	StopOutlined,
} from "@ant-design/icons";
import type { UIMessage } from "@tanstack/ai-react";
import { fetchServerSentEvents } from "@tanstack/ai-react";
import type {
	InputProps,
	LayoutProps,
	MessageProps,
	PartProps,
} from "@tanstack/ai-react/ui";
import { createChatHook } from "@tanstack/ai-react/ui";
import { Alert, Button, Input, Tooltip, Typography } from "antd";
import { createContext, useContext, useState } from "react";
import { MarkdownContent } from "../components/MarkdownContent";
import { ThinkingBubble } from "../components/ThinkingBubble";
import { CHAT_INPUT_PLACEHOLDER, PRESET_PROMPTS } from "../constants";
import { buildDefaultSystemPrompt } from "../prompts";
import type { AiRichNotify } from "../types";

const { Text } = Typography;

/** 运行期注入给 chat 组件的配置（不含 endpointUrl/onComplete，二者走模块 ref） */
export interface EditorChatConfig {
	/** 自定义 system 提示词（缺省用包内置模板） */
	systemPrompt?: string;
	/** 随每次发送透传的服务端元数据（如 { providerId }，经 body 进入 forwardedProps） */
	requestMeta?: Record<string, unknown>;
	/** 「应用到编辑器」回调（代码块替换当前内容） */
	onApplyHtml?: (html: string) => void;
	/** 消息提示回调（复制代码等轻提示） */
	notify?: AiRichNotify;
}

/** 供宿主在 <chat.AppChat/> 外层提供运行期配置 */
export const EditorCfgContext = createContext<EditorChatConfig>({});

/** chat 组件内部读取运行期配置 */
function useEditorCfg(): EditorChatConfig {
	return useContext(EditorCfgContext);
}

/** 提取 UIMessage 的文本内容（拼接 text part） */
function textOf(message: UIMessage): string {
	let text = "";
	for (const part of message.parts) {
		if (part.type === "text" && typeof part.content === "string") {
			text += part.content;
		}
	}
	return text;
}

/** 组装每次发送的 body（合并 requestMeta 与 systemPrompt） */
function sendBody(cfg: EditorChatConfig): Record<string, unknown> {
	return {
		...cfg.requestMeta,
		systemPrompt: cfg.systemPrompt ?? buildDefaultSystemPrompt(),
	};
}

/**
 * 构建每个实例的 chat 运行时覆盖项（connection / onFinish）。
 * createChatHook 的 options 在模块作用域固定，而 endpointUrl / onComplete 是每实例动态值，
 * 故经 useAppChat 的 overrides 注入（运行时 {...options, ...overrides} 会覆盖同名字段），
 * 使多实例互不串线。返回对象需在 useAppChat 处做一次类型转义（库的 overrides 类型未收编这两个字段）。
 */
export function createInstanceChatOverrides(
	endpointUrlRef: { current: string },
	onCompleteRef: { current: ((content: string) => void) | undefined },
) {
	return {
		connection: fetchServerSentEvents(() => endpointUrlRef.current),
		onFinish: (message: UIMessage) => {
			const content = textOf(message);
			if (content.trim()) onCompleteRef.current?.(content);
		},
	};
}

// ---- createChatHook options（模块作用域固定；connection/onFinish 由各实例经 overrides 注入） ----
const chatOptions = {};

// ---- UI 组件 ----

/** 消息壳：user 右对齐灰底圆角气泡；assistant 纯文本（无头像/无卡片） */
function ChatMessage({ message, Parts }: MessageProps<typeof chatOptions>) {
	if (message.role === "user") {
		return (
			<div className="flex justify-end">
				<div className="max-w-[85%] rounded-2xl bg-background-secondary px-4 py-2.5 text-sm text-foreground">
					<span className="whitespace-pre-wrap break-words">
						{textOf(message)}
					</span>
				</div>
			</div>
		);
	}
	// 助手消息：正文/代码块/思考气泡独立铺在背景上
	return (
		<div className="min-w-0 flex-1">
			<Parts />
		</div>
	);
}

/** 文本 part：MarkdownContent（markdown 富文本 + 代码块「应用到编辑器」） */
function TextPart({ part }: PartProps<typeof chatOptions, "text">) {
	const cfg = useEditorCfg();
	return (
		<MarkdownContent
			content={part.content}
			onApplyHtml={cfg.onApplyHtml}
			notify={cfg.notify}
		/>
	);
}

/** 思考 part：ThinkingBubble（流式中显示「思考中…」） */
function ThinkingPart({ part }: PartProps<typeof chatOptions, "thinking">) {
	const chat = useChatContext();
	return <ThinkingBubble thinking={part.content} streaming={chat.isLoading} />;
}

/** 未识别 part 兜底：不渲染 */
function FallbackPart(_props: PartProps<typeof chatOptions>) {
	return null;
}

/** 输入区：大圆角输入框（textarea + 底部工具栏：快捷键提示 + 发送/停止/清空） */
function ChatInput(_props: InputProps<typeof chatOptions>) {
	const chat = useChatContext();
	const cfg = useEditorCfg();
	const [input, setInput] = useState("");

	const handleSend = () => {
		const text = input.trim();
		if (!text || chat.isLoading) return;
		// 失败由 chat.error 驱动界面提示；此处吞掉 rejection 避免未处理 promise
		chat.sendMessage(text, { body: sendBody(cfg) }).catch(() => {});
		setInput("");
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		// 中文输入法组合态不触发发送
		if ((e.nativeEvent as KeyboardEvent).isComposing) return;
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	return (
		<div className="rounded-2xl border border-border bg-background shadow-sm">
			<Input.TextArea
				value={input}
				onChange={(e) => setInput(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={CHAT_INPUT_PLACEHOLDER}
				autoSize={{ minRows: 2, maxRows: 6 }}
				disabled={chat.isLoading}
				variant="borderless"
				className="px-4 pt-3 text-sm leading-6"
			/>
			<div className="flex items-center justify-between gap-2 px-3 pb-2.5">
				<span className="text-xs text-foreground-tertiary">
					Enter 发送，Shift+Enter 换行
				</span>
				<div className="flex items-center gap-2">
					{chat.isLoading ? (
						<Button
							size="small"
							danger
							icon={<StopOutlined />}
							onClick={() => chat.stop()}
						>
							停止
						</Button>
					) : (
						<Tooltip title="清空对话">
							<Button
								size="small"
								type="text"
								icon={<DeleteOutlined />}
								disabled={chat.messages.length === 0}
								onClick={() => chat.setMessages([])}
							/>
						</Tooltip>
					)}
					<Button
						size="small"
						type="primary"
						icon={<SendOutlined />}
						disabled={!input.trim()}
						onClick={handleSend}
						className="min-w-[72px]"
					>
						发送
					</Button>
				</div>
			</div>
		</div>
	);
}

/** 布局壳：消息滚动区（空态建议卡片）+ 底部输入框 */
function ChatLayout({
	Messages,
	Interrupts,
	Input: ChatInputRef,
}: LayoutProps<typeof chatOptions>) {
	const chat = useChatContext();
	const cfg = useEditorCfg();

	const handlePreset = (preset: string) => {
		if (chat.isLoading) return;
		// 失败由 chat.error 驱动界面提示；此处吞掉 rejection 避免未处理 promise
		chat.sendMessage(preset, { body: sendBody(cfg) }).catch(() => {});
	};

	return (
		<div className="flex h-full flex-col bg-background">
			{/* 消息区 */}
			<div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 py-3">
				{/* 中断列表：有 pending 中断（工具审批等）时在任何状态下都展示 */}
				<Interrupts />
				{chat.messages.length === 0 ? (
					<div className="flex min-h-full flex-col items-center justify-center px-1">
						<RobotOutlined className="text-2xl text-foreground-tertiary/50" />
						<Text className="mt-2 mb-6 text-sm text-foreground-tertiary">
							输入需求，或选择下方推荐指令
						</Text>
						<div className="w-full text-left">
							<div className="mb-2.5 text-sm font-medium text-foreground-tertiary">
								为你推荐
							</div>
							<div className="flex flex-col gap-3">
								{PRESET_PROMPTS.map((preset) => (
									<button
										key={preset}
										type="button"
										disabled={chat.isLoading}
										onClick={() => handlePreset(preset)}
										className="rounded-2xl border border-border bg-background px-4 py-3.5 text-left text-sm text-foreground transition-colors hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
									>
										{preset}
									</button>
								))}
							</div>
						</div>
					</div>
				) : (
					<div className="space-y-4">
						<Messages />
					</div>
				)}
			</div>

			{/* 输入框 */}
			<div className="shrink-0 border-t border-divider p-3">
				<ChatInputRef />
			</div>

			{chat.error && (
				<Alert
					type="error"
					showIcon
					message={chat.error.message}
					className="text-sm"
				/>
			)}
		</div>
	);
}

// ---- createChatHook 绑定（模块作用域一次） ----
export const { useAppChat, useChatContext } = createChatHook({
	options: chatOptions,
	components: {
		input: ChatInput,
		message: ChatMessage,
		layout: ChatLayout,
	},
	partsComponents: {
		text: TextPart,
		thinking: ThinkingPart,
		fallback: FallbackPart,
	},
});
