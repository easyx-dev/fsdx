/**
 * AI 厂商配置服务（app 服务层）
 * 读写 system_config.ai_providers（对象 JSON：{ [厂商id]: { name, baseUrl, apiKey, default?, models } }）。
 * 页面为专用「AI 厂商」管理，数据不新增 DB 表。
 */
import { upsertConfig } from "#/services/config/config.server";
import { AI_TIMEOUT_MS, readProviders } from "./ai.provider";
import { type AiProvidersConfig, aiProvidersSchema } from "./ai.schemas";

/** ai_providers 系统配置键 */
export const AI_PROVIDERS_CONFIG_KEY = "ai_providers";

/** 读取 AI 厂商列表（已归一化；空/非法降级为空数组） */
export async function getAiProviderList() {
	return readProviders();
}

/** 保存 AI 厂商配置（整体对象覆盖写入 ai_providers 键） */
export async function saveAiProviderList(
	providers: AiProvidersConfig,
): Promise<void> {
	const validated = aiProvidersSchema.parse(providers);
	await upsertConfig(
		AI_PROVIDERS_CONFIG_KEY,
		JSON.stringify(validated),
		"AI 厂商配置（对象 JSON）：{ [厂商id]: { name, baseUrl, apiKey, default?, models: { [模型名]: { name?, default?, contextLimit?, outputLimit?, jsonOutput?, toolCalls?, reasoning?, input?, output? } } } }，底层走 OpenAI 兼容协议",
		"json",
		"AI设置",
		false,
	);
}

/**
 * 调用 OpenAI 兼容 /models 端点拉取可用模型 id 列表（供管理页弹窗「拉取模型列表」）。
 * @throws 网络/HTTP 失败或响应异常时抛友好错误
 */
export async function fetchProviderModels(
	baseUrl: string,
	apiKey: string,
): Promise<string[]> {
	const url = `${baseUrl.replace(/\/+$/, "")}/models`;
	let res: Response;
	try {
		res = await fetch(url, {
			headers: { Authorization: `Bearer ${apiKey}` },
			signal: AbortSignal.timeout(AI_TIMEOUT_MS),
		});
	} catch {
		throw new Error("连接 AI 服务失败，请检查 API 基础地址");
	}
	if (!res.ok) {
		throw new Error(`拉取模型列表失败（HTTP ${res.status}）`);
	}
	const data = (await res.json()) as { data?: Array<{ id?: string }> };
	if (!Array.isArray(data.data)) {
		throw new Error("模型列表响应格式异常");
	}
	const ids = data.data
		.map((m) => m.id)
		.filter((id): id is string => typeof id === "string" && !!id);
	if (!ids.length) {
		throw new Error("未获取到可用模型");
	}
	return ids;
}
