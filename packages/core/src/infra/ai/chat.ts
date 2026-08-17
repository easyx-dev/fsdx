/**
 * 非流式 AI 对话：deep/fast 模型调用
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
 * 调用深度思考模型进行对话
 * @returns 聊天结果
 */
export async function deepChat(
	messages: ChatMessage[],
	options?: ChatOptions,
): Promise<ChatResult> {
	return chat("deep", messages, options);
}

/**
 * 调用快速模型进行对话
 * @returns 聊天结果
 */
export async function fastChat(
	messages: ChatMessage[],
	options?: ChatOptions,
): Promise<ChatResult> {
	return chat("fast", messages, options);
}

/**
 * 通用聊天调用
 * deep 模型失败（超时/5xx/空内容）时降级 fast 重试，保证产出；空内容在单模型内重试
 */
async function chat(
	type: AiModelType,
	messages: ChatMessage[],
	options?: ChatOptions,
): Promise<ChatResult> {
	const { logger } = assertDeps();
	const client = await getClient();
	if (!client) {
		throw new Error("AI 客户端未配置，请检查 ai_base_url 和 ai_api_key");
	}

	// deep 模型失败时降级 fast 重试，提高成功率
	const attemptTypes: AiModelType[] =
		type === "deep" ? ["deep", "fast"] : [type];
	let lastError: Error | null = null;

	for (const attemptType of attemptTypes) {
		try {
			const result = await attemptChat(client, attemptType, messages, options);
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
				"AI 调用失败，尝试降级/重试",
			);
		}
	}

	throw lastError ?? new Error("AI 调用失败");
}

/** 单模型调用：构建请求参数 + 空内容重试 */
async function attemptChat(
	client: OpenAI,
	type: AiModelType,
	messages: ChatMessage[],
	options?: ChatOptions,
): Promise<ChatResult> {
	const { logger } = assertDeps();
	const model = await getModelName(type);
	if (!model) {
		throw new Error(`AI 模型名称未配置，请检查 ai_${type}_model`);
	}

	const params = buildChatParams(model, messages, options);
	// 记录原始 max_tokens，空内容重试时可尝试去除（部分端点对 max_tokens 兼容性差）
	const originalMaxTokens = options?.maxTokens;

	// 空内容重试（带递增退避；重试时变化参数提高成功率）
	for (let attempt = 0; attempt <= EMPTY_RETRY_LIMIT; attempt++) {
		const completion = await client.chat.completions.create(
			params as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
		);

		const choice = completion.choices[0];
		if (choice?.message.content) {
			return {
				content: choice.message.content,
				model,
				usage: extractUsage(completion.usage),
			};
		}

		// 诊断日志：记录响应细节，便于定位端点空内容原因
		logger.warn(
			{
				model,
				attempt,
				finishReason: choice?.finish_reason ?? null,
				usage: completion.usage
					? {
							promptTokens: completion.usage.prompt_tokens,
							completionTokens: completion.usage.completion_tokens,
							totalTokens: completion.usage.total_tokens,
						}
					: null,
				refusal: choice?.message.refusal ?? null,
			},
			"AI 返回空内容，重试",
		);

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
