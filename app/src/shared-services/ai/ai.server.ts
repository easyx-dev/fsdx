/**
 * 通用 AI 服务编排层（app 内业务 AI 能力）
 * 负责把 @tanstack/ai 的 chat() 与 ai.client 的 provider/adapter 组合成可复用能力。
 * 这里承担「流式产出 / 非流式取文本」等编排逻辑；业务层（翻译、demo、富编辑器）只依赖本模块，不直接接触 provider 构建。
 */

import {
	type ChatStream,
	chat,
	type ModelMessage,
	type UIMessage,
} from "@tanstack/ai";
import { getAiAdapter } from "./ai.provider";

/** 供 chat() 的对话消息（UIMessage 或 ModelMessage 均被 chat() 接受并内部归一化） */
export type AiChatInputMessage = UIMessage | ModelMessage;

/** 通用流式对话入参 */
export interface AiChatStreamParams {
	/** 完整对话历史（不含 system，system 经 systemPrompts 透传） */
	messages: AiChatInputMessage[];
	/** system 提示词列表（由调用方组装并透传） */
	systemPrompts?: string[];
	/** 目标厂商 ID（可选，缺省用默认厂商） */
	providerId?: string;
	/** 模型采样参数（OpenAI 兼容 Chat Completions 语义：temperature / max_tokens 等） */
	modelOptions?: Record<string, unknown>;
	/** 会话 ID（AG-UI 协议，缺省由 adapter 生成） */
	threadId?: string;
	/** 运行 ID（AG-UI 协议，缺省由 adapter 生成） */
	runId?: string;
	/** 取消信号（前端关闭/停止时中止后端生成） */
	abortController?: AbortController;
}

/** 通用非流式文本生成入参 */
export interface AiCompleteParams {
	messages: AiChatInputMessage[];
	systemPrompts?: string[];
	providerId?: string;
	modelOptions?: Record<string, unknown>;
	abortController?: AbortController;
}

/** 读取当前配置的 AI adapter，未配置时抛友好错误 */
async function getReadyAdapter(providerId?: string) {
	const adapter = await getAiAdapter(providerId);
	if (!adapter) {
		throw new Error("AI 客户端未配置，请检查 ai_providers 配置");
	}
	return adapter;
}

/**
 * 发起通用 AI 流式对话，返回 TanStack AI 流（含 text/thinking/tool 事件，由 Server Route 透传为 SSE）
 * @returns ChatStream：AsyncIterable<StreamChunk>
 */
export async function streamAiChat(
	params: AiChatStreamParams,
): Promise<ChatStream> {
	const adapter = await getReadyAdapter(params.providerId);
	return chat({
		adapter,
		messages: params.messages,
		systemPrompts: params.systemPrompts,
		modelOptions: params.modelOptions,
		threadId: params.threadId,
		runId: params.runId,
		abortController: params.abortController,
	});
}

/**
 * 非流式一次性文本生成（供 AI 翻译等「点一次出一次结果」的业务复用）
 * 借助 chat({ stream: false }) 直接返回完整文本，无需手动消费流。
 * @returns 模型回复的完整文本
 */
export async function completeText(params: AiCompleteParams): Promise<string> {
	const adapter = await getReadyAdapter(params.providerId);
	return chat({
		adapter,
		messages: params.messages,
		systemPrompts: params.systemPrompts,
		modelOptions: params.modelOptions,
		abortController: params.abortController,
		stream: false,
	});
}
