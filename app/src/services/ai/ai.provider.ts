/**
 * AI 客户端（app 服务层）：读取系统配置构建多厂商 provider/adapter
 * 配置为单 JSON 键（ai_providers，对象形式：{ [厂商id]: { name, baseUrl, apiKey, default?, models } }），
 * 底层全部走 TanStack AI 的 OpenAI 兼容协议（openaiCompatible）。
 * provider 按「厂商 id + 配置指纹」缓存为跨 bundle 共享 Map（globalThis，Nitro 入口与 SSR 渲染器共享）。
 * 纯基建职责：只构建 provider/adapter，不编排 chat()、不消费流、不感知业务。
 */
import {
	type AnyTextAdapter,
	createModel,
	type ExtendedModelDef,
} from "@tanstack/ai";
import { openaiCompatible } from "@tanstack/ai-openai/compatible";
import { logger } from "#/lib/logger/logger";
import { getConfig } from "#/services/config/config.server";
import {
	type AiModelView,
	type AiProvidersConfig,
	type AiProviderView,
	aiProviderConfigSchema,
} from "./ai.schemas";

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

/**
 * 旧「数组」格式（首版）一次性兼容迁移到对象：id 取自元素 id 字段，model 归一化为 models。
 * 仅用于存量数据，新数据不再写入数组。
 */
function migrateArrayToObject(parsed: unknown[]): AiProvidersConfig {
	const obj: AiProvidersConfig = {};
	for (const item of parsed) {
		if (typeof item !== "object" || item === null) continue;
		const rec = item as Record<string, unknown>;
		const id = rec.id;
		if (typeof id !== "string" || !id) continue;
		const base: Record<string, unknown> = {
			name: rec.name,
			baseUrl: rec.baseUrl,
			apiKey: rec.apiKey,
			default: rec.default,
		};
		const model = rec.model;
		if (typeof model === "string" && model) {
			base.models = { [model]: { name: model, default: true } };
		}
		const result = aiProviderConfigSchema.safeParse(base);
		if (result.success) obj[id] = result.data;
	}
	return obj;
}

/**
 * 对象配置 → 归一化视图数组（逐项校验，跳过非法厂商与非法模型 id，避免一个脏数据让全部厂商失效）。
 */
function toProviderViews(config: unknown): AiProviderView[] {
	if (typeof config !== "object" || config === null || Array.isArray(config)) {
		return [];
	}
	const views: AiProviderView[] = [];
	for (const [id, providerRaw] of Object.entries(config)) {
		if (!id || id.includes("/") || id.includes("#")) {
			logger.warn({ id }, "跳过非法的 AI 厂商 id");
			continue;
		}
		const result = aiProviderConfigSchema.safeParse(providerRaw);
		if (!result.success) {
			logger.warn({ id }, "跳过非法的 AI 厂商配置项");
			continue;
		}
		const provider = result.data;
		const models: AiModelView[] = [];
		for (const [modelId, model] of Object.entries(provider.models)) {
			if (!modelId || modelId.includes("#")) {
				logger.warn({ providerId: id, modelId }, "跳过非法的模型 id");
				continue;
			}
			models.push({ id: modelId, ...model });
		}
		views.push({
			id,
			name: provider.name,
			baseUrl: provider.baseUrl,
			apiKey: provider.apiKey,
			default: provider.default,
			models,
		});
	}
	return views;
}

/** 读取并校验多厂商配置；失败/非法 JSON/非对象时降级为空数组并告警 */
export async function readProviders(): Promise<AiProviderView[]> {
	const raw = await getConfig("ai_providers");
	if (!raw) return [];
	try {
		const parsed: unknown = JSON.parse(raw);
		if (Array.isArray(parsed)) {
			// 首版数组存量数据一次性迁移到对象
			return toProviderViews(migrateArrayToObject(parsed));
		}
		return toProviderViews(parsed);
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
	providers: AiProviderView[],
	providerId?: string,
): AiProviderView | null {
	const usable = providers.filter(
		(p) => p.baseUrl && p.apiKey && p.models.length > 0,
	);
	if (!usable.length) return null;
	if (providerId) {
		return usable.find((p) => p.id === providerId) ?? null;
	}
	return usable.find((p) => p.default) ?? usable[0];
}

/** 解析厂商下目标模型 id：指定模型 / default 模型 / 首个非空 */
export function resolveModel(
	provider: AiProviderView,
	modelId?: string,
): string | null {
	const models = provider.models;
	if (!models.length) return null;
	if (modelId) {
		return models.find((m) => m.id === modelId)?.id ?? null;
	}
	return models.find((m) => m.default)?.id ?? models[0]!.id;
}

/** 读取并解析目标厂商配置（未命中返回 null） */
export async function readProviderConfig(
	providerId?: string,
): Promise<AiProviderView | null> {
	const providers = await readProviders();
	return resolveProvider(providers, providerId);
}

/**
 * 模型配置 → openaiCompatible 的 model 定义：零声明走裸字符串（乐观默认），有声明走 createModel。
 * 能力位（reasoning/jsonOutput/toolCalls/input）映射为 features/input，在声明时影响 provider 请求形态。
 */
function toModelDef(model: AiModelView): string | ExtendedModelDef {
	const features: string[] = [];
	if (model.reasoning) features.push("reasoning");
	if (model.jsonOutput) features.push("structured_outputs");
	if (model.toolCalls) features.push("function_calling");
	const hasInput = Array.isArray(model.input) && model.input.length > 0;
	// 未声明输入模态且未声明能力位 → 裸字符串（乐观默认）
	if (!hasInput && features.length === 0) return model.id;
	// 仅声明输入模态（未声明能力位）时补齐乐观功能位，
	// 避免丢失裸字符串默认具备的工具调用/结构化输出能力
	if (features.length === 0) {
		features.push("function_calling", "structured_outputs");
	}
	return createModel(model.id, {
		input: model.input ?? ["text"],
		features,
	});
}

/** 构建（或命中缓存）某厂商的 provider 函数；配置指纹变更时重建 */
async function getOrBuildProvider(config: AiProviderView): Promise<AiProvider> {
	const fingerprint = `${config.baseUrl}||${config.apiKey}||${JSON.stringify(config.models)}`;
	const cache = getProviderCache();
	const slot = cache.get(config.id);
	if (slot && slot.fingerprint === fingerprint) {
		return slot.provider;
	}

	// 适配器底层为 Chat Completions 协议（DeepSeek/Moonshot/Qwen/本地 vLLM 等 OpenAI 兼容端点）
	const raw = openaiCompatible({
		name: config.name,
		baseURL: config.baseUrl,
		apiKey: config.apiKey,
		models: config.models.map(toModelDef),
		// 客户端超时与重试：超时避免无限挂起，5xx/429 由 SDK 指数退避重试
		timeout: AI_TIMEOUT_MS,
		maxRetries: AI_MAX_RETRIES,
	});
	const built = raw as unknown as AiProvider;
	cache.set(config.id, { fingerprint, provider: built });
	logger.info(
		{
			providerId: config.id,
			baseUrl: config.baseUrl,
			models: config.models.map((m) => m.id),
		},
		"AI provider 已初始化",
	);
	return built;
}

/**
 * 获取目标厂商的 OpenAI 兼容 provider（按厂商 id + 指纹缓存，配置变更时重建）。
 * 返回 null 表示无可命中的已配置厂商。
 */
export async function getAiProvider(
	providerId?: string,
): Promise<AiProvider | null> {
	const config = await readProviderConfig(providerId);
	if (!config) return null;
	return getOrBuildProvider(config);
}

/**
 * 获取目标厂商对应的 OpenAI 兼容 text adapter（供 ai.server 传给 chat({ adapter })）。
 * 无可命中的已配置厂商或目标模型时返回 null，由调用方决定是否报友好错误。
 */
export async function getAiAdapter(
	providerId?: string,
	modelId?: string,
): Promise<AnyTextAdapter | null> {
	const config = await readProviderConfig(providerId);
	if (!config) return null;
	const model = resolveModel(config, modelId);
	if (!model) return null;
	const provider = await getOrBuildProvider(config);
	return provider(model);
}
