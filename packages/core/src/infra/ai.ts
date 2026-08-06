/**
 * AI SDK 封装：基于 OpenAI 兼容接口的深度思考与快速模型调用
 * 配置经 initAi 注入的 getConfig 回调读取，未 init 直接调用时抛错（fail-fast）
 */
import OpenAI from "openai";
import type { Logger } from "./logger";

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

/** AI 模块依赖注入 */
export interface AiDeps {
	/** 系统配置读取回调（ai_* 键） */
	getConfig: (key: string) => Promise<string>;
	/** 日志实例 */
	logger: Logger;
}

// ========== 私有状态 ==========

let _deps: AiDeps | null = null;
let _client: OpenAI | null = null;
let _lastConfigFingerprint = "";

/**
 * 注入 AI 模块依赖，bootstrap 启动时调用
 */
export function initAi(deps: AiDeps): void {
	_deps = deps;
}

/** 测试专用：重置注入状态与缓存的客户端 */
export function resetAiForTest(): void {
	_deps = null;
	_client = null;
	_lastConfigFingerprint = "";
}

/** 获取依赖，未注入时抛错（fail-fast） */
function assertDeps(): AiDeps {
	if (!_deps) {
		throw new Error("AI 模块未初始化，请先调用 initAi()");
	}
	return _deps;
}

/** 读取 AI 配置并计算指纹 */
async function readAiConfig(): Promise<{
	baseUrl: string;
	apiKey: string;
	deepModel: string;
	fastModel: string;
	fingerprint: string;
}> {
	const { getConfig } = assertDeps();
	const baseUrl = await getConfig("ai_base_url");
	const apiKey = await getConfig("ai_api_key");
	const deepModel = await getConfig("ai_deep_model");
	const fastModel = await getConfig("ai_fast_model");
	const fingerprint = `${baseUrl}||${apiKey}||${deepModel}||${fastModel}`;
	return { baseUrl, apiKey, deepModel, fastModel, fingerprint };
}

/** 获取 OpenAI 客户端（延迟初始化，配置变更时重建） */
async function getClient(): Promise<OpenAI | null> {
	const { logger } = assertDeps();
	const config = await readAiConfig();

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
async function getModelName(type: AiModelType): Promise<string> {
	const config = await readAiConfig();
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

	const model = await getModelName(type);
	if (!model) {
		throw new Error(`AI 模型名称未配置，请检查 ai_${type}_model`);
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
		logger.warn({ model, type, error: message }, "AI 调用失败");
		throw err;
	}
}
