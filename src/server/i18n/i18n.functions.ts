/**
 * 国际化 Server Function 包装器：查询 + 维护翻译数据 + 导出 / 导入
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toJson } from "#/lib/export/export.utils";
import type { Locale } from "#/lib/i18n/i18n.types";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "#/lib/i18n/i18n.types";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import type {
	ContentTranslationExportData,
	TranslationImportResult,
	UiTranslationExportData,
} from "#/server/i18n/i18n.server";
import {
	deleteContentTranslation,
	deleteUITranslation,
	getAllContentTranslationsForExport,
	getAllUITranslationsForExport,
	getContentTranslations,
	getFieldTranslations,
	getUITranslations,
	importContentTranslations,
	importUiTranslations,
	listContentTranslations,
	listUITranslations,
	upsertContentTranslation,
	upsertUITranslation,
} from "#/server/i18n/i18n.server";

const localeSchema = z.enum(SUPPORTED_LOCALES).default(DEFAULT_LOCALE);

// ══════════════════ 查询 ══════════════════

/** 获取指定语言的 UI 翻译数据 */
export const getI18nBundle = createServerFn({ method: "GET" })
	.inputValidator(z.object({ locale: localeSchema }))
	.handler(async ({ data: { locale } }) => {
		return getUITranslations(locale);
	});

/** 获取当前请求的 locale 及对应翻译（从 requestMiddleware context 读取 Cookie locale） */
export const getLocaleBundle = createServerFn({ method: "GET" }).handler(
	async ({ context }) => {
		const locale: Locale = (context.locale as Locale) || DEFAULT_LOCALE;
		const translations = await getUITranslations(locale);
		return { locale, translations };
	},
);
/** 获取某实体的字段翻译 */
export const getEntityTranslations = createServerFn({ method: "GET" })
	.inputValidator(
		z.object({
			entityType: z.string(),
			entityId: z.string(),
			locale: localeSchema,
		}),
	)
	.handler(async ({ data: { entityType, entityId, locale } }) => {
		return getContentTranslations(entityType, entityId, locale);
	});

// ══════════════════ UI 翻译维护 ══════════════════

/** UI 翻译列表 */
export const listUITranslationsFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_VIEW)])
	.inputValidator(
		z.object({
			locale: localeSchema.optional(),
			keyword: z.string().optional(),
			page: z.number().optional(),
			pageSize: z.number().optional(),
		}),
	)
	.handler(async ({ data }) => {
		return listUITranslations(data);
	});

/** UI 翻译创建/更新 */
export const saveUITranslationFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_MANAGE)])
	.inputValidator(
		z.object({
			id: z.string().optional(),
			locale: localeSchema,
			key: z.string().min(1).max(300),
			value: z.string().min(1),
			valueType: z.string().optional(),
		}),
	)
	.handler(async ({ data }) => {
		return upsertUITranslation(
			data as Parameters<typeof upsertUITranslation>[0],
		);
	});

/** UI 翻译删除 */
export const deleteUITranslationFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_MANAGE)])
	.inputValidator(z.object({ id: z.string().min(1) }))
	.handler(async ({ data: { id } }) => {
		await deleteUITranslation(id);
		return { success: true };
	});

// ══════════════════ UI 翻译导出 / 导入 ══════════════════

/** 导出 UI 翻译数据（JSON） */
export const exportUITranslationsFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_EXPORT)])
	.handler(async () => {
		const translations = await getAllUITranslationsForExport();
		return toJson({ translations });
	});

/** 导入 UI 翻译数据（JSON） */
export const importUITranslationsFn = createServerFn({ method: "POST" })
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
	.handler(async ({ data: { data } }): Promise<TranslationImportResult> => {
		return importUiTranslations(data as UiTranslationExportData);
	});

// ══════════════════ 实体翻译维护 ══════════════════

/** 实体翻译列表 */
export const listContentTranslationsFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_VIEW)])
	.inputValidator(
		z.object({
			entityType: z.string().optional(),
			locale: localeSchema.optional(),
			keyword: z.string().optional(),
			page: z.number().optional(),
			pageSize: z.number().optional(),
		}),
	)
	.handler(async ({ data }) => {
		return listContentTranslations(data);
	});

/** 获取某实体某字段的所有语言翻译（抽屉用） */
export const getFieldTranslationsFn = createServerFn({ method: "GET" })
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
export const saveContentTranslationFn = createServerFn({ method: "POST" })
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
	.handler(async ({ data }) => {
		return upsertContentTranslation(
			data as Parameters<typeof upsertContentTranslation>[0],
		);
	});

/** 实体翻译删除 */
export const deleteContentTranslationFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_MANAGE)])
	.inputValidator(z.object({ id: z.string().min(1) }))
	.handler(async ({ data: { id } }) => {
		await deleteContentTranslation(id);
		return { success: true };
	});

// ══════════════════ 实体翻译导出 / 导入 ══════════════════

/** 导出实体翻译数据（JSON） */
export const exportContentTranslationsFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_EXPORT)])
	.handler(async () => {
		const translations = await getAllContentTranslationsForExport();
		return toJson({ translations });
	});

/** 导入实体翻译数据（JSON） */
export const importContentTranslationsFn = createServerFn({ method: "POST" })
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
	.handler(async ({ data: { data } }): Promise<TranslationImportResult> => {
		return importContentTranslations(data as ContentTranslationExportData);
	});
