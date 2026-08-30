/**
 * AI Rich Editor 开放类型：会话协议、适配器契约与组件 Props
 * 协议层与 UI 库无关，供任意宿主适配实现
 */

/** 对话消息（不含 system，system 由组件的 systemPrompt 注入；assistant 可携带思考内容） */
export type ChatTurn = {
	role: "user" | "assistant";
	content: string;
	/** 深度思考模型的思考过程（仅 assistant，流结束后随消息持久化展示） */
	thinking?: string;
};

/** AI 输出形态：fragment=页面内容片段（默认），document=完整 HTML 文档 */
export type AiChatMode = "fragment" | "document";

/** OpenAI 协议：对话请求（组件 → 适配器） */
export interface AiChatRequest {
	/** 完整对话历史（按时间顺序，组件负责裁剪） */
	messages: ChatTurn[];
	/** 输出形态 */
	mode: AiChatMode;
	/** 编辑器当前内容快照 */
	snapshot?: string;
	/** system 提示词（组件按 mode 生成默认值，使用方可通过 AiRichEditor.systemPrompt 覆盖） */
	systemPrompt: string;
	/** 请求参数透传（适配器可忽略或映射为 OpenAI 参数） */
	options?: {
		temperature?: number;
		maxTokens?: number;
		model?: string;
	};
}

/** Token 用量统计 */
export interface AiChatUsage {
	promptTokens?: number;
	completionTokens?: number;
	totalTokens?: number;
}

/** 流式对话数据单元（适配器产出，组件驱动 UI） */
export type AiChatChunk =
	| { type: "delta"; text: string }
	| { type: "thinking"; text: string }
	| { type: "attempt"; model: string }
	| { type: "done"; model: string; usage?: AiChatUsage }
	| { type: "error"; message: string };

/**
 * 对话方法适配器（核心契约）
 * 由调用方实现：内部可走 OpenAI / 宿主 SFn / SSE / mock，
 * 借助 AsyncIterable 天然支持流式与 abort（signal 中止即停）
 */
export type AiChatAdapter = (
	request: AiChatRequest,
	signal: AbortSignal,
) => AsyncIterable<AiChatChunk>;

/** 消息提示回调（可选注入；缺省用 antd 静态 message） */
export type AiRichNotify = (
	type: "success" | "warning" | "error",
	content: string,
) => void;

/** 三栏编辑器 Props（兼容 antd Form.Item 受控注入） */
export interface AiRichEditorProps {
	/** 当前 HTML 内容 */
	value?: string;
	/** 内容变化回调 */
	onChange?: (value: string) => void;
	/** 编辑器整体高度（默认 640） */
	height?: number | string;
	/** AI 对话默认输出形态（默认 fragment） */
	mode?: AiChatMode;
	/** 对话方法适配器（必填） */
	adapter: AiChatAdapter;
	/** 消息提示回调（可选，缺省 antd 静态 message） */
	notify?: AiRichNotify;
	/** AI 回复结束后是否自动把内容应用到编辑器（默认 true，仍保留手动「应用到编辑器」按钮） */
	autoApply?: boolean;
	/** 自定义 system 提示词（可选，缺省按 mode 使用包内置模板） */
	systemPrompt?: string;
}
