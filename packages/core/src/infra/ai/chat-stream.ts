/**
 * 流式 AI 对话：逐 token 回调推送
 * deep 模型失败时自动降级 fast 重试，空内容在单模型内参数变化重试
 */
import type OpenAI from "openai";
import {
	assertDeps,
	buildChatParams,
	delay,
	EMPTY_RETRY_LIMIT,
	extractUsage,
	getClient,
	getModelName,
} from "./client";
import type {
	AiModelType,
	ChatMessage,
	ChatOptions,
	ChatResult,
} from "./types";

/**
 * 调用深度思考模型并流式返回（逐 token 回调）
 * deep 失败自动降级 fast；空内容在单模型内重试
 * @param onAttemptChange 模型尝试发生降级（deep→fast）时回调，用于清空已展示的残缺流
 * @param onThinking 推理模型思考内容（reasoning_content）逐段回调
 */
export async function deepChatStream(
	messages: ChatMessage[],
	options?: ChatOptions,
	onToken?: (delta: string) => void,
	onThinking?: (delta: string) => void,
	onAttemptChange?: (type: AiModelType) => void,
): Promise<ChatResult> {
	return chatStream(
		"deep",
		messages,
		options,
		onToken,
		onThinking,
		onAttemptChange,
	);
}

/**
 * 调用快速模型并流式返回（逐 token 回调）
 * 空内容在单模型内重试
 * @param onThinking 推理模型思考内容（reasoning_content）逐段回调
 */
export async function fastChatStream(
	messages: ChatMessage[],
	options?: ChatOptions,
	onToken?: (delta: string) => void,
	onThinking?: (delta: string) => void,
): Promise<ChatResult> {
	return chatStream("fast", messages, options, onToken, onThinking);
}

/**
 * 通用流式聊天调用
 * deep 模型失败（超时/5xx/空内容）时降级 fast 重试，保证产出；空内容在单模型内重试
 */
async function chatStream(
	type: AiModelType,
	messages: ChatMessage[],
	options?: ChatOptions,
	onToken?: (delta: string) => void,
	onThinking?: (delta: string) => void,
	onAttemptChange?: (type: AiModelType) => void,
): Promise<ChatResult> {
	const { logger } = assertDeps();
	const client = await getClient();
	if (!client) {
		throw new Error("AI 客户端未配置，请检查 ai_base_url 和 ai_api_key");
	}

	const attemptTypes: AiModelType[] =
		type === "deep" ? ["deep", "fast"] : [type];
	let lastError: Error | null = null;

	for (const attemptType of attemptTypes) {
		// 发生降级（deep→fast 切换模型）时通知调用方，供清空已展示的残缺 token 流
		if (attemptType !== attemptTypes[0]) {
			onAttemptChange?.(attemptType);
		}
		try {
			const result = await attemptChatStream(
				client,
				attemptType,
				messages,
				options,
				onToken,
				onThinking,
			);
			if (result.content) {
				return result;
			}
			lastError = new Error("AI 返回空内容");
		} catch (err) {
			lastError = err instanceof Error ? err : new Error(String(err));
			logger.warn(
				{
					model: await getModelName(attemptType),
					type: attemptType,
					error: lastError.message,
				},
				"AI 流式调用失败，尝试降级/重试",
			);
		}
	}

	throw lastError ?? new Error("AI 调用失败");
}

/** 单模型流式调用：构建请求参数 + 空内容重试，逐 token 回调 */
async function attemptChatStream(
	client: OpenAI,
	type: AiModelType,
	messages: ChatMessage[],
	options?: ChatOptions,
	onToken?: (delta: string) => void,
	onThinking?: (delta: string) => void,
): Promise<ChatResult> {
	const { logger } = assertDeps();
	const model = await getModelName(type);
	if (!model) {
		throw new Error(`AI 模型名称未配置，请检查 ai_${type}_model`);
	}

	const params = buildChatParams(model, messages, options);
	const originalMaxTokens = options?.maxTokens;

	// 空内容重试（流式结束后累计内容为空才判定为空）
	for (let attempt = 0; attempt <= EMPTY_RETRY_LIMIT; attempt++) {
		const stream = await client.chat.completions.create({
			...params,
			stream: true,
		} as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming);

		let content = "";
		let usage: ChatResult["usage"];
		for await (const chunk of stream) {
			const delta = chunk.choices[0]?.delta;
			if (delta?.content) {
				content += delta.content;
				onToken?.(delta.content);
			}
			// DeepSeek 推理模型的思考内容是 OpenAI SDK 未收录的非标准字段
			const thinking = (delta as { reasoning_content?: string | null })
				?.reasoning_content;
			if (thinking) {
				onThinking?.(thinking);
			}
			if (chunk.usage) {
				usage = extractUsage(chunk.usage);
			}
		}

		if (content) {
			return { content, model, usage };
		}

		logger.warn({ model, attempt }, "AI 流式返回空内容，重试");

		// 变化参数：max_tokens 可能不被端点支持导致空内容，去掉后再试
		if (attempt === 0 && params.max_tokens !== undefined) {
			delete params.max_tokens;
		}
		// 若去掉 max_tokens 仍空，恢复并改用 temperature=0 尝试；
		// thinking 关闭场景本就不携带 temperature，跳过置零避免与 extraBody 冲突
		if (attempt === 1 && params.max_tokens === undefined) {
			params.max_tokens = originalMaxTokens;
			if (params.temperature !== undefined) {
				params.temperature = 0;
			}
		}

		if (attempt < EMPTY_RETRY_LIMIT) {
			await delay(500 * (attempt + 1));
		}
	}

	return { content: "", model, usage: undefined };
}
