/**
 * AI 客户端（app 服务层）：读取系统配置构建多厂商 provider/adapter
 * 配置为单 JSON 键（ai_providers：[{ id, name, baseUrl, apiKey, model, default? }]），底层全部走
 * TanStack AI 的 OpenAI 兼容协议（openaiCompatible）。
 * provider 按「厂商 id + 配置指纹」缓存为跨 bundle 共享 Map（globalThis，Nitro 入口与 SSR 渲染器共享）。
 * 纯基建职责：只构建 provider/adapter，不编排 chat()、不消费流、不感知业务。
 */
import type { AnyTextAdapter } from "@tanstack/ai";
import { openaiCompatible } from "@tanstack/ai-openai/compatible";
import { logger } from "#/lib/logger/logger";
import { getConfig } from "#/services/config/config.server";
import { type AiProviderConfig, aiProviderConfigSchema } from "./ai.schemas";

/** AI HTTP 请求超时（毫秒）：与上游网关超时对齐，避免请求无限挂起 */
export const AI_TIMEOUT_MS = 180_000;
/** OpenAI SDK 层面对 429/5xx/连接错误的重试次数 */
export const AI_MAX_RETRIES = 2;

/**
 * 构建出的 provider 函数形态：传入模型名返回对应 adapter。
 * 运行时模型名来自系统配置（动态字符串），故在此以 string 收窄。
 */
export type AiProvider = (model: string) => AnyTextAdapter;

/** 跨 bundle 共享 provider 缓存的 globalThis 存储键 */
const AI_PROVIDER_CACHE_KEY = "__FSDX_AI_PROVIDERS__";

/** 单个厂商的缓存槽（按厂商 id 缓存，配置指纹变更时替换，避免无限增长） */
interface AiProviderSlot {
	/** 构建该 provider 时的配置指纹 */
	fingerprint: string;
	provider: AiProvider;
}

/**
 * 从 globalThis 读取跨 bundle 共享的 provider 缓存 Map（键：厂商 id，值：{fingerprint, provider}）。
 * 避免模块级单例在 Nitro 入口与 SSR 渲染器两条 bundle 间分裂；按 id 缓存限长，多厂商互相隔离。
 */
function getProviderCache(): Map<string, AiProviderSlot> {
	const global = globalThis as typeof globalThis &
		Record<string, Map<string, AiProviderSlot> | undefined>;
	if (!global[AI_PROVIDER_CACHE_KEY]) {
		global[AI_PROVIDER_CACHE_KEY] = new Map();
	}
	return global[AI_PROVIDER_CACHE_KEY]!;
}

/** 读取并校验多厂商配置；失败/非法 JSON/非数组时降级为空数组并告警 */
export async function readProviders(): Promise<AiProviderConfig[]> {
	const raw = await getConfig("ai_providers");
	if (!raw) return [];
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			logger.warn("ai_providers 不是数组，视为空");
			return [];
		}
		// 逐项校验：单项非法只跳过该厂商并记录，避免一个脏数据让全部厂商失效
		const providers: AiProviderConfig[] = [];
		for (const item of parsed) {
			const result = aiProviderConfigSchema.safeParse(item);
			if (result.success) {
				providers.push(result.data);
			} else {
				logger.warn({ item }, "跳过非法的 AI 厂商配置项");
			}
		}
		return providers;
	} catch (err) {
		logger.warn(
			{ err: err instanceof Error ? err.message : String(err) },
			"ai_providers 配置解析失败，视为空",
		);
		return [];
	}
}

/**
 * 从厂商列表解析目标厂商：优先 providerId，其次 default:true，最后取首个非空。
 * 无可用厂商返回 null。
 */
export function resolveProvider(
	providers: AiProviderConfig[],
	providerId?: string,
): AiProviderConfig | null {
	const usable = providers.filter((p) => p.baseUrl && p.apiKey && p.model);
	if (!usable.length) return null;
	if (providerId) {
		return usable.find((p) => p.id === providerId) ?? null;
	}
	return usable.find((p) => p.default) ?? usable[0];
}

/** 读取并解析目标厂商配置（未命中返回 null） */
export async function readProviderConfig(
	providerId?: string,
): Promise<AiProviderConfig | null> {
	const providers = await readProviders();
	return resolveProvider(providers, providerId);
}

/** 解析目标厂商并构建/命中缓存的 provider，返回 { provider, model } */
async function resolveAndBuildProvider(
	providerId?: string,
): Promise<{ provider: AiProvider; model: string } | null> {
	const config = await readProviderConfig(providerId);
	if (!config) return null;

	const fingerprint = `${config.baseUrl}||${config.apiKey}||${config.model}`;
	const cache = getProviderCache();
	const slot = cache.get(config.id);
	if (slot && slot.fingerprint === fingerprint) {
		return { provider: slot.provider, model: config.model };
	}

	// 适配器底层为 Chat Completions 协议（DeepSeek/Moonshot/Qwen/本地 vLLM 等 OpenAI 兼容端点）
	const raw = openaiCompatible({
		name: config.name,
		baseURL: config.baseUrl,
		apiKey: config.apiKey,
		models: [config.model],
		// 客户端超时与重试：超时避免无限挂起，5xx/429 由 SDK 指数退避重试
		timeout: AI_TIMEOUT_MS,
		maxRetries: AI_MAX_RETRIES,
	});
	const built = raw as unknown as AiProvider;
	cache.set(config.id, { fingerprint, provider: built });
	logger.info(
		{ providerId: config.id, baseUrl: config.baseUrl, model: config.model },
		"AI provider 已初始化",
	);
	return { provider: built, model: config.model };
}

/**
 * 获取目标厂商的 OpenAI 兼容 provider（按厂商 id + 指纹缓存，配置变更时重建）。
 * 返回 null 表示无可命中的已配置厂商。
 */
export async function getAiProvider(
	providerId?: string,
): Promise<AiProvider | null> {
	const result = await resolveAndBuildProvider(providerId);
	return result?.provider ?? null;
}

/**
 * 获取目标厂商对应的 OpenAI 兼容 text adapter（供 ai.server 传给 chat({ adapter })）。
 * 无可命中的已配置厂商时返回 null，由调用方决定是否报友好错误。
 */
export async function getAiAdapter(
	providerId?: string,
): Promise<AnyTextAdapter | null> {
	const result = await resolveAndBuildProvider(providerId);
	return result ? result.provider(result.model) : null;
}
