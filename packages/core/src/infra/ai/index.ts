/**
 * AI 模块统一导出
 * 配置经 initAi 注入的 getConfig 回调读取，未 init 直接调用时抛错（fail-fast）
 */

export { deepChat, fastChat } from "./chat";
export { deepChatStream, fastChatStream } from "./chat-stream";
export { initAi, resetAiForTest } from "./client";
export { truncateJsonForLlm } from "./truncate";
export type {
	AiDeps,
	AiModelType,
	ChatMessage,
	ChatOptions,
	ChatResult,
} from "./types";
