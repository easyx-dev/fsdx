/**
 * AI 客户端管理：initAi 依赖注入、OpenAI 客户端懒创建与配置指纹重建、请求参数构建
 * 配置经 getConfig 回调读取，未 init 直接调用时抛错（fail-fast）
 */
import OpenAI from "openai";
import { createGlobalDepsStore } from "../deps-store";
import type {
	AiDeps,
	AiModelType,
	ChatMessage,
	ChatOptions,
	ChatResult,
} from "./types";

/** AI HTTP 请求超时（毫秒）：与上游网关超时对齐，避免请求无限挂起 */
export const AI_TIMEOUT_MS = 180_000;
/** OpenAI SDK 层面对 429/5xx/连接错误的重试次数 */
export const AI_MAX_RETRIES = 2;
/** 单模型内空内容重试上限 */
export const EMPTY_RETRY_LIMIT = 2;

/** 简单延迟 */
export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// ========== 私有状态 ==========

/**
 * 注入状态挂载于 globalThis：入口（bootstrap）与 SSR 渲染器分别打包本模块，
 * 模块级单例会分裂导致 SSR bundle 内 fail-fast；经 createGlobalDepsStore 跨 bundle 共享
 */
const depsStore = createGlobalDepsStore<AiDeps>("__FSDX_AI_DEPS__");

let _client: OpenAI | null = null;
let _lastConfigFingerprint = "";

/**
 * 注入 AI 模块依赖，bootstrap 启动时调用
 * 写入 globalThis，Nitro 入口与 SSR 渲染器共享
 */
export function initAi(deps: AiDeps): void {
	depsStore.set(deps);
}

/** 测试专用：重置注入状态与缓存的客户端 */
export function resetAiForTest(): void {
	depsStore.reset();
	_client = null;
	_lastConfigFingerprint = "";
}

/** 获取依赖，未注入时抛错（fail-fast） */
export function assertDeps(): AiDeps {
	const deps = depsStore.get();
	if (!deps) {
		throw new Error("AI 模块未初始化，请先调用 initAi()");
	}
	return deps;
}

/** 读取 AI 配置并计算指纹 */
export async function readAiConfig(): Promise<{
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
export async function getClient(): Promise<OpenAI | null> {
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
			// 客户端超时与重试：超时避免无限挂起，5xx/429 由 SDK 指数退避重试
			timeout: AI_TIMEOUT_MS,
			maxRetries: AI_MAX_RETRIES,
		});
		_lastConfigFingerprint = config.fingerprint;
		logger.info({ baseUrl: config.baseUrl }, "AI 客户端已初始化");
	}

	return _client;
}

/** 获取指定类型的模型名称 */
export async function getModelName(type: AiModelType): Promise<string> {
	const config = await readAiConfig();
	return type === "deep" ? config.deepModel : config.fastModel;
}

/** 构建消息数组 */
export function buildMessages(
	messages: ChatMessage[],
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
	return messages.map((m) => ({
		role: m.role,
		content: m.content,
	}));
}

/** 构建 chat.completions 请求参数（流式与非流式共用） */
export function buildChatParams(
	model: string,
	messages: ChatMessage[],
	options?: ChatOptions,
): Record<string, unknown> {
	const isThinkingDisabled =
		options?.extraBody &&
		typeof options.extraBody.thinking === "object" &&
		options.extraBody.thinking !== null &&
		(options.extraBody.thinking as Record<string, unknown>).type === "disabled";

	const params: Record<string, unknown> = {
		model,
		messages: buildMessages(messages),
		max_tokens: options?.maxTokens,
	};
	// 思考模式关闭时不传 temperature（部分端点对该组合兼容性差）
	if (!isThinkingDisabled) {
		params.temperature = options?.temperature ?? 0.7;
	}
	if (options?.extraBody) {
		params.extra_body = options.extraBody;
	}
	return params;
}

/** 从 completion 提取 token 用量 */
export function extractUsage(
	usage?: OpenAI.Completions.CompletionUsage,
): ChatResult["usage"] {
	return usage
		? {
				promptTokens: usage.prompt_tokens,
				completionTokens: usage.completion_tokens,
				totalTokens: usage.total_tokens,
			}
		: undefined;
}
