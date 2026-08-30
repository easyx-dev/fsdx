/**
 * 通用 AI 流式对话服务层：把调用方传入的 systemPrompt + 历史组装后调 deepChatStream
 * 无业务假设，任意 OpenAI 兼容场景（语义由 systemPrompt 承载）均复用
 */
import {
	type AiModelType,
	type ChatMessage,
	type ChatResult,
	deepChatStream,
} from "@fsdx/core/ai";
import type { AiChatMessageInput } from "./ai-chat.schemas";

/** 通用 AI 流式对话的默认最大输出 token 数（单次输出的安全上限） */
export const AI_CHAT_DEFAULT_MAX_TOKENS = 4096;

/** 流式编排入参 */
export interface AiChatStreamParams {
	/** 完整对话历史（不含 system） */
	messages: AiChatMessageInput[];
	/** system 提示词（由调用方组装并透传） */
	systemPrompt: string;
	/** 温度（可选） */
	temperature?: number;
	/** 最大输出 token 数（可选，缺省用通用默认） */
	maxTokens?: number;
}

/** 流式回调（镜像 @fsdx/core/ai 流式接口，供 SFn 逐帧输出） */
export interface AiChatStreamCallbacks {
	/** 正文字符增量 */
	onToken?: (delta: string) => void;
	/** 深度思考模型的思考内容增量 */
	onThinking?: (delta: string) => void;
	/** 模型发生降级（deep→fast）时通知（用于前端提示清空残缺流） */
	onAttemptChange?: (type: AiModelType) => void;
}

/**
 * 发起通用 AI 流式对话
 * 将外部 systemPrompt + 历史组装后调用 deepChatStream（deep 失败自动降级 fast）
 */
export function streamAiChat(
	params: AiChatStreamParams,
	callbacks?: AiChatStreamCallbacks,
): Promise<ChatResult> {
	const chatMessages: ChatMessage[] = [
		{ role: "system", content: params.systemPrompt },
		...params.messages,
	];

	return deepChatStream(
		chatMessages,
		{
			temperature: params.temperature,
			maxTokens: params.maxTokens ?? AI_CHAT_DEFAULT_MAX_TOKENS,
		},
		callbacks?.onToken,
		callbacks?.onThinking,
		callbacks?.onAttemptChange,
	);
}
