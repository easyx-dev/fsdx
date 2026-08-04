/**
 * 系统配置管理：CRUD 操作 + 内存缓存
 */
import { and, asc, eq, isNull } from "drizzle-orm";
import type { EditorType } from "#/constants/editor-types";
import { db } from "#/db/index";
import { contentTranslation, systemConfig } from "#/db/schema";
import { configCache, configTranslationCache } from "#/lib/cache/config.cache";
import { DEFAULT_LOCALE, type Locale } from "#/lib/i18n/i18n.types";
import { logger } from "#/lib/logger/logger";

export type ConfigRecord = typeof systemConfig.$inferSelect;

export async function loadConfigCache(): Promise<void> {
	const configs = await db
		.select({
			id: systemConfig.id,
			key: systemConfig.key,
			value: systemConfig.value,
			clientVisible: systemConfig.clientVisible,
		})
		.from(systemConfig)
		.where(isNull(systemConfig.deletedAt));
	configCache.set("all", configs);
	logger.info({ count: configs.length }, "系统配置缓存加载完成");
}

export async function getConfig(key: string): Promise<string> {
	let list = configCache.get("all");
	if (!list) {
		await loadConfigCache();
		list = configCache.get("all") ?? [];
	}
	return list.find((c) => c.key === key)?.value ?? "";
}

export async function getConfigList() {
	return db
		.select()
		.from(systemConfig)
		.where(isNull(systemConfig.deletedAt))
		.orderBy(asc(systemConfig.groupName), asc(systemConfig.key));
}

export async function createConfig(params: {
	key: string;
	value: string;
	clientVisible?: boolean;
	valueType?: string;
	groupName?: string;
	description?: string;
}) {
	const [record] = await db.insert(systemConfig).values(params).returning();
	await loadConfigCache();
	return record;
}

/**
 * 插入或更新系统配置（key 冲突时更新 value）
 * 用于初始化流程，避免因 ensurePresetConfigs 已插入默认值导致冲突
 */
export async function upsertConfig(
	key: string,
	value: string,
	description?: string,
	valueType?: string,
	groupName?: string,
	clientVisible?: boolean,
): Promise<void> {
	const existing = await db.query.systemConfig.findFirst({
		where: eq(systemConfig.key, key),
	});

	if (existing) {
		await db
			.update(systemConfig)
			.set({
				value,
				clientVisible: clientVisible ?? existing.clientVisible,
				valueType: valueType ?? existing.valueType,
				groupName: groupName ?? existing.groupName,
				description: description ?? existing.description,
				updatedAt: new Date(),
			})
			.where(eq(systemConfig.id, existing.id));
	} else {
		await db.insert(systemConfig).values({
			key,
			value,
			description,
			valueType,
			groupName,
			clientVisible,
		});
	}

	await loadConfigCache();
	logger.info({ key }, "系统配置已写入");
}

export async function updateConfig(
	id: string,
	params: {
		value?: string;
		clientVisible?: boolean;
		valueType?: string;
		groupName?: string;
		description?: string;
	},
) {
	const [updated] = await db
		.update(systemConfig)
		.set({ ...params, updatedAt: new Date() })
		.where(eq(systemConfig.id, id))
		.returning();
	if (updated) {
		await loadConfigCache();
	}
	return updated ?? null;
}

export async function deleteConfig(id: string) {
	const existing = await db.query.systemConfig.findFirst({
		where: eq(systemConfig.id, id),
	});
	if (!existing) return false;
	await db
		.update(systemConfig)
		.set({ deletedAt: new Date() })
		.where(eq(systemConfig.id, id));
	await loadConfigCache();
	return true;
}

// ========== 预置系统配置 ==========

/** 预置系统配置常量（仅服务端启动时自动插入的配置项） */
const PRESET_CONFIGS: {
	key: string;
	value: string;
	description: string;
	clientVisible: boolean;
	valueType: EditorType;
	groupName: string;
}[] = [
	{
		key: "site_name",
		value: "FSDX",
		description: "站点名称",
		clientVisible: true,
		valueType: "input",
		groupName: "站点设置",
	},
	{
		key: "keywords",
		value: "",
		description: "SEO head 关键词",
		clientVisible: true,
		valueType: "text",
		groupName: "站点设置",
	},
	{
		key: "description",
		value: "",
		description: "SEO head 站点描述",
		clientVisible: true,
		valueType: "text",
		groupName: "站点设置",
	},
	{
		key: "company_address",
		value: "",
		description: "公司地址",
		clientVisible: true,
		valueType: "text",
		groupName: "站点设置",
	},
	{
		key: "company_tell",
		value: "",
		description: "公司电话",
		clientVisible: true,
		valueType: "input",
		groupName: "站点设置",
	},
	{
		key: "company_email",
		value: "",
		description: "公司邮箱",
		clientVisible: true,
		valueType: "input",
		groupName: "站点设置",
	},
	{
		key: "smtp_host",
		value: "",
		description: "SMTP 服务器地址",
		clientVisible: false,
		valueType: "input",
		groupName: "邮件设置",
	},
	{
		key: "smtp_port",
		value: "",
		description: "SMTP 端口",
		clientVisible: false,
		valueType: "number",
		groupName: "邮件设置",
	},
	{
		key: "smtp_secure",
		value: "false",
		description: "是否使用 SSL/TLS",
		clientVisible: false,
		valueType: "input",
		groupName: "邮件设置",
	},
	{
		key: "smtp_user",
		value: "",
		description: "SMTP 用户名",
		clientVisible: false,
		valueType: "input",
		groupName: "邮件设置",
	},
	{
		key: "smtp_pass",
		value: "",
		description: "SMTP 密码",
		clientVisible: false,
		valueType: "input",
		groupName: "邮件设置",
	},
	{
		key: "smtp_from",
		value: "",
		description: "发件人邮箱地址",
		clientVisible: false,
		valueType: "input",
		groupName: "邮件设置",
	},
	{
		key: "ai_base_url",
		value: "",
		description: "AI API 基础地址",
		clientVisible: false,
		valueType: "input",
		groupName: "AI设置",
	},
	{
		key: "ai_api_key",
		value: "",
		description: "AI API 密钥",
		clientVisible: false,
		valueType: "input",
		groupName: "AI设置",
	},
	{
		key: "ai_deep_model",
		value: "",
		description: "深度思考模型名称",
		clientVisible: false,
		valueType: "input",
		groupName: "AI设置",
	},
	{
		key: "ai_fast_model",
		value: "",
		description: "快速模型名称",
		clientVisible: false,
		valueType: "input",
		groupName: "AI设置",
	},
	{
		key: "ai_translation_prompt",
		value:
			"你是一名专业的{targetLang}母语译者，需要将{sourceLang}文本流畅自然地翻译成{targetLang}。\n\n## 翻译规则\n1. 仅输出翻译后的内容，不要添加任何解释或额外说明\n2. 翻译必须保持与原文完全相同的段落数量和格式结构\n3. 如果文本包含 HTML 标签，请在保持语义通顺的前提下，将标签放置在翻译中的合适位置\n4. 对于不应翻译的内容（如专有名词、代码等），保留原文不做翻译\n\n## 待翻译内容\n{sourceText}",
		description:
			"AI 翻译提示词模板，支持占位符 {sourceLang}、{targetLang}、{sourceText}",
		clientVisible: false,
		valueType: "text",
		groupName: "AI设置",
	},
	{
		key: "sms_provider",
		value: "",
		description: "短信服务商（aliyun = 阿里云，留空禁用）",
		clientVisible: false,
		valueType: "input",
		groupName: "短信设置",
	},
	{
		key: "sms_aliyun_access_key_id",
		value: "",
		description: "阿里云 AccessKey ID",
		clientVisible: false,
		valueType: "input",
		groupName: "短信设置",
	},
	{
		key: "sms_aliyun_access_key_secret",
		value: "",
		description: "阿里云 AccessKey Secret",
		clientVisible: false,
		valueType: "input",
		groupName: "短信设置",
	},
	{
		key: "sms_aliyun_sign_name",
		value: "",
		description: "阿里云短信签名",
		clientVisible: false,
		valueType: "input",
		groupName: "短信设置",
	},
	{
		key: "sms_aliyun_template_code",
		value: "",
		description: "阿里云短信模板码",
		clientVisible: false,
		valueType: "input",
		groupName: "短信设置",
	},
];

/** 运行时校验预置系统配置（幂等安全，恢复软删除的预设项） */
export async function ensurePresetConfigs(): Promise<void> {
	for (const preset of PRESET_CONFIGS) {
		const existing = await db.query.systemConfig.findFirst({
			where: eq(systemConfig.key, preset.key),
		});
		if (existing?.deletedAt) {
			// 预置配置不允许删除，恢复软删除的记录
			await db
				.update(systemConfig)
				.set({
					value: preset.value,
					clientVisible: preset.clientVisible,
					valueType: preset.valueType,
					groupName: preset.groupName,
					description: preset.description,
					deletedAt: null,
					updatedAt: new Date(),
				})
				.where(eq(systemConfig.id, existing.id));
			logger.info({ key: preset.key }, "预置系统配置已恢复");
		} else if (!existing) {
			await db.insert(systemConfig).values(preset);
			logger.info({ key: preset.key }, "预置系统配置已创建");
		}
	}
	await loadConfigCache();
}

// ========== 客户端可见配置 ==========

/** 客户端可见的配置行：先取缓存，缓存 miss 则查库并回填 */
export async function getVisibleConfigRows(): Promise<
	{
		id: string;
		key: string;
		value: string;
	}[]
> {
	let list = configCache.get("all");
	if (!list) {
		await loadConfigCache();
		list = configCache.get("all") ?? [];
	}
	return list.filter((c) => c.clientVisible);
}

/** 获取系统配置的 content_translation 翻译（按 locale 缓存） */
export async function getConfigTranslations(
	locale: Locale,
): Promise<Record<string, string>> {
	if (locale === DEFAULT_LOCALE) return {};

	const cached = configTranslationCache.get(locale);
	if (cached) return cached;

	const translations = await db
		.select()
		.from(contentTranslation)
		.where(
			and(
				eq(contentTranslation.entityType, "system_config"),
				eq(contentTranslation.locale, locale),
			),
		);

	const result: Record<string, string> = {};
	for (const t of translations) result[t.entityId] = t.value;

	configTranslationCache.set(locale, result);
	logger.info({ locale, count: translations.length }, "系统配置翻译缓存已加载");
	return result;
}

/** 刷新系统配置翻译缓存（管理端编辑翻译后调用） */
export async function refreshConfigTranslationCache(
	locale?: Locale,
): Promise<void> {
	if (locale) {
		configTranslationCache.delete(locale);
		await getConfigTranslations(locale);
		logger.info({ locale }, "系统配置翻译缓存已刷新");
	} else {
		for (const key of configTranslationCache.keys()) {
			configTranslationCache.delete(key);
		}
		logger.info("全部系统配置翻译缓存已清理");
	}
}
