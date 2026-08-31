/**
 * AI Rich Editor 开放类型：会话协议、适配器契约与组件 Props
 * 协议层与 UI 库无关，供任意宿主适配实现
 */

/** 对话消息（不含 system，system 由组件的系统提示词注入；assistant 可携带思考内容） */
export type ChatTurn = {
	role: "user" | "assistant";
	content: string;
	/** 深度思考模型的思考过程（仅 assistant，流结束后随消息持久化展示） */
	thinking?: string;
};

/** OpenAI 协议：对话请求（组件 → 适配器） */
export interface AiChatRequest {
	/** 完整对话历史（按时间顺序，组件负责裁剪） */
	messages: ChatTurn[];
	/** 编辑器当前内容快照 */
	snapshot?: string;
	/** system 提示词（组件生成默认值，使用方可通过 config.systemPrompt 覆盖） */
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

/**
 * 统一包配置项（设置面板展示/编辑，保存后生效）
 * adapter、height 为顶层属性，不归入此对象
 */
export interface AiRichEditorConfig {
	/** AI 回复结束后是否自动把内容应用到编辑器（默认 true，仍保留手动「应用到编辑器」按钮） */
	autoApply?: boolean;
	/** 自定义 system 提示词（可选，缺省用包内置模板） */
	systemPrompt?: string;
	/** 预览容器 <head> 附加代码（一段原始 HTML，如内置 <style>/<script>，原样注入） */
	previewHead?: string;
	/** 消息提示回调（可选，缺省 antd 静态 message；设置面板只读展示） */
	notify?: AiRichNotify;
}

/** 三栏编辑器 Props（兼容 antd Form.Item 受控注入） */
export interface AiRichEditorProps {
	/** 当前 HTML 内容 */
	value?: string;
	/** 内容变化回调 */
	onChange?: (value: string) => void;
	/** 对话方法适配器（必填，不进设置面板） */
	adapter: AiChatAdapter;
	/** 编辑器整体高度（默认 640，宿主布局参数） */
	height?: number | string;
	/**
	 * 统一包配置（**仅初始值，非受控**）。
	 * 挂载后 config 变化不会生效；运行期改配置请走设置面板（保存后即时生效），
	 * 并经 onConfigChange 回写宿主以持久化。
	 */
	config?: AiRichEditorConfig;
	/** 设置面板保存后回写（可选，用于宿主持久化） */
	onConfigChange?: (config: AiRichEditorConfig) => void;
}
