/**
 * AI 厂商配置服务（app 服务层）
 * 读写 system_config.ai_providers（JSON 数组）。页面为专用「AI 厂商」管理，数据不新增 DB 表。
 */
import { upsertConfig } from "#/services/config/config.server";
import { readProviders } from "./ai.provider";
import { type AiProviderConfig, aiProvidersSchema } from "./ai.schemas";

/** ai_providers 系统配置键 */
export const AI_PROVIDERS_CONFIG_KEY = "ai_providers";

/** 读取 AI 厂商列表（已校验；空/非法降级为空数组） */
export async function getAiProviderList(): Promise<AiProviderConfig[]> {
	return readProviders();
}

/** 保存 AI 厂商列表（整列表覆盖写入 ai_providers 键） */
export async function saveAiProviderList(
	providers: AiProviderConfig[],
): Promise<void> {
	const validated = aiProvidersSchema.parse(providers);
	await upsertConfig(
		AI_PROVIDERS_CONFIG_KEY,
		JSON.stringify(validated),
		"AI 厂商配置（JSON 数组）：[{ id, name, baseUrl, apiKey, model, default? }]，底层走 OpenAI 兼容协议",
		"json",
		"AI设置",
		false,
	);
}
