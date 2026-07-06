/**
 * 国际化 Server Function 包装器：查询 + 维护翻译数据 + 导出 / 导入
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fastChat } from "#/lib/ai/ai";
import { toJson } from "#/lib/export/export.utils";
import type { Locale } from "#/lib/i18n/i18n.types";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "#/lib/i18n/i18n.types";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import { getConfig } from "#/server/config/config.server";
import type {
	ContentTranslationExportData,
	TranslationImportResult,
	UiTranslationExportData,
} from "#/server/i18n/i18n.server";
import {
	getAllContentTranslationsForExport,
	getAllUITranslationsForExport,
	getFieldTranslations,
	getUITranslations,
	importContentTranslations,
	importUiTranslations,
	upsertContentTranslation,
} from "#/server/i18n/i18n.server";
import { logOperation } from "#/server/operation-log/operation-log.server";

const localeSchema = z.enum(SUPPORTED_LOCALES).default(DEFAULT_LOCALE);

// ══════════════════ 查询 ══════════════════

/** 获取当前请求的 locale 及对应翻译（从 requestMiddleware context 读取 Cookie locale） */
export const getLocaleBundleSFn = createServerFn({ method: "GET" }).handler(
	async ({ context }) => {
		const locale: Locale = (context.locale as Locale) || DEFAULT_LOCALE;
		const translations = await getUITranslations(locale);
		return { locale, translations };
	},
);
// ══════════════════ UI 翻译导出 / 导入 ══════════════════

/** 导出 UI 翻译数据（JSON） */
export const exportUITranslationsSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_EXPORT)])
	.handler(async () => {
		const translations = await getAllUITranslationsForExport();
		return toJson({ translations });
	});

/** 导入 UI 翻译数据（JSON） */
export const importUITranslationsSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_IMPORT)])
	.inputValidator(
		z.object({
			data: z.object({
				translations: z.array(
					z.object({
						locale: z.string().min(1),
						key: z.string().min(1),
						value: z.string().min(1),
						valueType: z.string().optional(),
					}),
				),
			}),
		}),
	)
	.handler(
		async ({ data: { data }, context }): Promise<TranslationImportResult> => {
			const result = await importUiTranslations(
				data as UiTranslationExportData,
			);
			logOperation({
				operatorId: context.user.id,
				operatorName: context.user.username,
				module: "translation",
				action: "import",
				targetType: "ui_translation",
				detail: { created: result.created, updated: result.updated },
			});
			return result;
		},
	);

// ══════════════════ 实体翻译维护 ══════════════════

/** 获取某实体某字段的所有语言翻译（抽屉用） */
export const getFieldTranslationsSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_VIEW)])
	.inputValidator(
		z.object({
			entityType: z.string(),
			entityId: z.string(),
			fieldName: z.string(),
		}),
	)
	.handler(async ({ data: { entityType, entityId, fieldName } }) => {
		return getFieldTranslations(entityType, entityId, fieldName);
	});

/** 实体翻译创建/更新 */
export const saveContentTranslationSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_MANAGE)])
	.inputValidator(
		z.object({
			id: z.string().optional(),
			entityType: z.string().min(1),
			entityId: z.string().min(1),
			fieldName: z.string().min(1),
			locale: localeSchema,
			value: z.string().min(1),
			valueType: z.string().optional(),
		}),
	)
	.handler(async ({ data, context }) => {
		const result = await upsertContentTranslation(
			data as Parameters<typeof upsertContentTranslation>[0],
		);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "translation",
			action: "update",
			targetType: "content_translation",
		});
		return result;
	});

// ══════════════════ 实体翻译导出 / 导入 ══════════════════

/** 导出实体翻译数据（JSON） */
export const exportContentTranslationsSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_EXPORT)])
	.handler(async () => {
		const translations = await getAllContentTranslationsForExport();
		return toJson({ translations });
	});

/** 导入实体翻译数据（JSON） */
export const importContentTranslationsSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_IMPORT)])
	.inputValidator(
		z.object({
			data: z.object({
				translations: z.array(
					z.object({
						entityType: z.string().min(1),
						entityId: z.string().min(1),
						fieldName: z.string().min(1),
						locale: z.string().min(1),
						value: z.string().min(1),
						valueType: z.string().optional(),
					}),
				),
			}),
		}),
	)
	.handler(
		async ({ data: { data }, context }): Promise<TranslationImportResult> => {
			const result = await importContentTranslations(
				data as ContentTranslationExportData,
			);
			logOperation({
				operatorId: context.user.id,
				operatorName: context.user.username,
				module: "translation",
				action: "import",
				targetType: "content_translation",
				detail: { created: result.created, updated: result.updated },
			});
			return result;
		},
	);

// ══════════════════ AI 翻译 ══════════════════

/** AI 翻译字段内容（使用 fast 模型） */
export const aiTranslateFieldSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_MANAGE)])
	.inputValidator(
		z.object({
			sourceText: z.string().min(1, "源文本不能为空"),
			targetLang: z.string().min(1),
			sourceLang: z.string().min(1),
		}),
	)
	.handler(async ({ data: { sourceText, targetLang, sourceLang } }) => {
		const promptTemplate = await getConfig("ai_translation_prompt");
		if (!promptTemplate) {
			throw new Error(
				"AI 翻译提示词未配置，请在系统配置中设置 ai_translation_prompt",
			);
		}
		const prompt = promptTemplate
			.replace(/\{sourceLang\}/g, sourceLang)
			.replace(/\{targetLang\}/g, targetLang)
			.replace(/\{sourceText\}/g, sourceText);

		const result = await fastChat([{ role: "user", content: prompt }], {
			temperature: 0.3,
		});
		if (!result.content) {
			throw new Error("AI 翻译服务不可用，请检查 AI 配置");
		}
		return result.content;
	});
