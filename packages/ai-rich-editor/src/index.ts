/**
 * AI Rich Editor 独立包统一出口
 * 协议层（适配器契约）与 UI 层一并导出，宿主按需引用
 */
export { AiRichEditor } from "./AiRichEditor";
export { ThinkingBubble } from "./components/ThinkingBubble";
export {
	DEFAULT_CONFIG,
	DEFAULT_HTML,
	DEFAULT_SYSTEM_PROMPT_TEMPLATE,
	PRESET_PROMPTS,
	PREVIEW_DEVICES,
	type PreviewDevice,
} from "./constants";
export { type AiChatController, useAiChat } from "./hooks/useAiChat";
export { buildDefaultSystemPrompt } from "./prompts";
export type {
	AiChatAdapter,
	AiChatChunk,
	AiChatRequest,
	AiChatUsage,
	AiRichEditorConfig,
	AiRichEditorProps,
	AiRichNotify,
	ChatTurn,
} from "./types";
export { buildPreviewDocument, extractHtmlFragments } from "./utils/extract";
