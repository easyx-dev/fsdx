/**
 * AI Rich Editor 独立包统一出口
 * UI 层与协议类型一并导出，宿主按需引用
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
export { buildDefaultSystemPrompt } from "./prompts";
export type {
	AiRichEditorConfig,
	AiRichEditorProps,
	AiRichNotify,
} from "./types";
export { buildPreviewDocument, extractHtmlFragments } from "./utils/extract";
