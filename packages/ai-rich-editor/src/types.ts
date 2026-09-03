/**
 * AI Rich Editor 开放类型：会话消息、控制器配置与组件 Props
 * 协议层与 UI 库无关，由宿主透传 SSE 端点（TanStack AI useChat 消费）
 */

/** 消息提示回调（可选注入；缺省用 antd 静态 message） */
export type AiRichNotify = (
	type: "success" | "warning" | "error",
	content: string,
) => void;

/**
 * 统一包配置项（设置面板展示/编辑，保存后生效）
 * endpointUrl、height 为顶层属性，不归入此对象
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
	/** 对话流式 SSE 端点 URL（由宿主提供，经 useChat 消费 TanStack AI SSE） */
	endpointUrl: string;
	/** 随每次对话请求透传的服务端附加元数据（如 { providerId }，经 forwardedProps 到达服务端） */
	requestMeta?: Record<string, unknown>;
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
