/**
 * AI SDK 封装：基于 OpenAI 兼容接口的深度思考与快速模型调用
 */
import OpenAI from "openai";
import { logger } from "#/lib/logger/logger";
import { getConfig } from "#/server/config/config.server";

/** 聊天消息 */
export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

/** 聊天选项 */
export interface ChatOptions {
	/** 温度参数，控制输出随机性 (0-2)，默认 0.7 */
	temperature?: number;
	/** 最大输出 token 数 */
	maxTokens?: number;
}

/** 聊天结果 */
export interface ChatResult {
	/** 模型回复内容 */
	content: string;
	/** 实际使用的模型名称 */
	model: string;
	/** Token 用量统计 */
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
}

/** 模型类型 */
export type AiModelType = "deep" | "fast";

// ========== 私有状态 ==========

let _client: OpenAI | null = null;
let _lastConfigFingerprint = "";

/** 读取 AI 配置并计算指纹 */
function readAiConfig(): {
	baseUrl: string;
	apiKey: string;
	deepModel: string;
	fastModel: string;
	fingerprint: string;
} {
	const baseUrl = getConfig("ai_base_url");
	const apiKey = getConfig("ai_api_key");
	const deepModel = getConfig("ai_deep_model");
	const fastModel = getConfig("ai_fast_model");
	const fingerprint = `${baseUrl}||${apiKey}||${deepModel}||${fastModel}`;
	return { baseUrl, apiKey, deepModel, fastModel, fingerprint };
}

/** 获取 OpenAI 客户端（延迟初始化，配置变更时重建） */
function getClient(): OpenAI | null {
	const config = readAiConfig();

	if (!config.baseUrl || !config.apiKey) {
		if (_client) {
			_client = null;
			_lastConfigFingerprint = "";
		}
		return null;
	}

	if (config.fingerprint !== _lastConfigFingerprint) {
		_client = new OpenAI({
			baseURL: config.baseUrl,
			apiKey: config.apiKey,
		});
		_lastConfigFingerprint = config.fingerprint;
		logger.info({ baseUrl: config.baseUrl }, "AI 客户端已初始化");
	}

	return _client;
}

/** 获取指定类型的模型名称 */
function getModelName(type: AiModelType): string {
	const config = readAiConfig();
	return type === "deep" ? config.deepModel : config.fastModel;
}

/** 构建消息数组 */
function buildMessages(
	messages: ChatMessage[],
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
	return messages.map((m) => ({
		role: m.role,
		content: m.content,
	}));
}

// ========== 导出函数 ==========

/**
 * 调用深度思考模型进行对话
 * @returns 聊天结果，配置未就绪时返回 null
 */
export async function deepChat(
	messages: ChatMessage[],
	options?: ChatOptions,
): Promise<ChatResult | null> {
	return chat("deep", messages, options);
}

/**
 * 调用快速模型进行对话
 * @returns 聊天结果，配置未就绪时返回 null
 */
export async function fastChat(
	messages: ChatMessage[],
	options?: ChatOptions,
): Promise<ChatResult | null> {
	return chat("fast", messages, options);
}

/**
 * 通用聊天调用
 */
async function chat(
	type: AiModelType,
	messages: ChatMessage[],
	options?: ChatOptions,
): Promise<ChatResult | null> {
	const client = getClient();
	if (!client) {
		logger.warn("AI 客户端未配置，跳过调用");
		return null;
	}

	const model = getModelName(type);
	if (!model) {
		logger.warn({ type }, "AI 模型名称未配置");
		return null;
	}

	try {
		const completion = await client.chat.completions.create({
			model,
			messages: buildMessages(messages),
			temperature: options?.temperature ?? 0.7,
			max_tokens: options?.maxTokens,
		});

		const choice = completion.choices[0];
		if (!choice?.message.content) {
			logger.warn({ model }, "AI 返回空内容");
			return {
				content: "",
				model,
				usage: completion.usage
					? {
							promptTokens: completion.usage.prompt_tokens,
							completionTokens: completion.usage.completion_tokens,
							totalTokens: completion.usage.total_tokens,
						}
					: undefined,
			};
		}

		return {
			content: choice.message.content,
			model,
			usage: completion.usage
				? {
						promptTokens: completion.usage.prompt_tokens,
						completionTokens: completion.usage.completion_tokens,
						totalTokens: completion.usage.total_tokens,
					}
				: undefined,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		logger.error({ model, type, error: message }, "AI 调用失败");
		return null;
	}
}
