/**
 * AI 模块 Schema：多厂商 provider 配置 + 请求校验
 */
import { z } from "zod";

/** 单个 AI 厂商配置 */
export const aiProviderConfigSchema = z.object({
	/** 厂商唯一标识（供调用侧 + 前端选择引用） */
	id: z.string().min(1, "厂商 ID 不能为空").max(64),
	/** 展示名称 */
	name: z.string().min(1, "厂商名称不能为空").max(64),
	/** OpenAI 兼容 API 基础地址 */
	baseUrl: z.string().min(1, "API 基础地址不能为空"),
	/** API 密钥 */
	apiKey: z.string().min(1, "API 密钥不能为空"),
	/** 默认使用的模型名 */
	model: z.string().min(1, "模型名不能为空"),
	/** 是否默认厂商（多个为 true 时取首个） */
	default: z.boolean().optional(),
});

/** 厂商配置列表（存储为 ai_providers 系统配置的 JSON 值） */
export const aiProvidersSchema = z.array(aiProviderConfigSchema);

export type AiProviderConfig = z.infer<typeof aiProviderConfigSchema>;

/** 写入厂商配置的入参（整列表保存） */
export const saveAiProvidersSchema = z.object({
	providers: aiProvidersSchema,
});
