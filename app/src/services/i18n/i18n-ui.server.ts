/**
 * UI 翻译模块：uiTranslation 表的查询、维护、导出与导入
 * 内存缓存全量 UI 翻译，按 locale 懒加载
 */
import type { Locale } from "@fsdx/core/i18n-types";
import { and, eq, like, or, type SQLWrapper } from "drizzle-orm";
import { EDITOR_TYPES, type EditorType } from "#/constants/editor-types";
import { db } from "#/db/index";
import { uiTranslation } from "#/db/schema";
import { logger } from "#/lib/logger/logger";
import { uiTranslationCache } from "#/services/i18n/ui-translation.cache";
import {
	buildSortClause,
	executePaginatedQuery,
	paginationOffset,
} from "#/services/query/query-utils.server";
import type { PaginatedSortParams } from "#/types/query";

// ═══════════════════════════════════════════════════
// UI 翻译查询
// ═══════════════════════════════════════════════════

/** 从数据库全量加载指定语言的所有 UI 翻译 */
export async function loadUITranslations(
	locale: Locale,
): Promise<Record<string, string>> {
	const rows = await db
		.select()
		.from(uiTranslation)
		.where(eq(uiTranslation.locale, locale));

	const result: Record<string, string> = {};
	for (const row of rows) {
		result[row.key] = row.value;
	}

	return result;
}

/** 获取 UI 翻译（优先缓存） */
export async function getUITranslations(
	locale: Locale,
): Promise<Record<string, string>> {
	const cached = uiTranslationCache.get(locale);
	if (cached) return cached;

	const result = await loadUITranslations(locale);
	uiTranslationCache.set(locale, result);
	return result;
}

/** 刷新 UI 翻译缓存（管理端编辑翻译后调用） */
export async function refreshUITranslationCache(
	locale?: Locale,
): Promise<void> {
	if (locale) {
		uiTranslationCache.delete(locale);
		await getUITranslations(locale);
		logger.info({ locale }, "UI 翻译缓存已刷新");
	} else {
		for (const key of uiTranslationCache.keys()) {
			uiTranslationCache.delete(key);
		}
		logger.info("全部 UI 翻译缓存已清理");
	}
}

// ═══════════════════════════════════════════════════
// UI 翻译维护
// ═══════════════════════════════════════════════════

/** UI 翻译列表查询参数 */
export interface ListUITranslationsParams extends PaginatedSortParams {
	locale?: Locale;
	keyword?: string;
}

/** UI 翻译列表 */
export async function listUITranslations(params?: ListUITranslationsParams) {
	const {
		locale,
		keyword,
		page = 1,
		pageSize = 20,
		sortField,
		sortOrder,
	} = params ?? {};
	const offset = paginationOffset(page, pageSize);

	const conditions: (SQLWrapper | undefined)[] = [];
	if (locale) conditions.push(eq(uiTranslation.locale, locale));
	if (keyword) {
		conditions.push(
			or(
				like(uiTranslation.key, `%${keyword}%`),
				like(uiTranslation.value, `%${keyword}%`),
			),
		);
	}

	const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

	const sortFieldMap = {
		key: uiTranslation.key,
		locale: uiTranslation.locale,
		updatedAt: uiTranslation.updatedAt,
	};
	const direction = buildSortClause(sortFieldMap, sortField, sortOrder, "key");

	return executePaginatedQuery(
		db
			.select()
			.from(uiTranslation)
			.where(whereCondition)
			.orderBy(direction)
			.limit(pageSize)
			.offset(offset),
		db.$count(db.select().from(uiTranslation).where(whereCondition)),
		page,
		pageSize,
	);
}

/** UI 翻译创建或更新（基于 locale + key 唯一约束） */
export async function upsertUITranslation(params: {
	id?: string;
	locale: Locale;
	key: string;
	value: string;
	valueType?: EditorType;
}) {
	const valueType: EditorType = params.valueType ?? "input";

	if (params.id) {
		// 更新已有记录
		await db
			.update(uiTranslation)
			.set({
				locale: params.locale,
				key: params.key,
				value: params.value,
				valueType,
				updatedAt: new Date(),
			})
			.where(eq(uiTranslation.id, params.id));
	} else {
		// 尝试查找已有记录
		const [existing] = await db
			.select()
			.from(uiTranslation)
			.where(
				and(
					eq(uiTranslation.locale, params.locale),
					eq(uiTranslation.key, params.key),
				),
			)
			.limit(1);
		if (existing) {
			await db
				.update(uiTranslation)
				.set({ value: params.value, valueType, updatedAt: new Date() })
				.where(eq(uiTranslation.id, existing.id));
		} else {
			await db.insert(uiTranslation).values({
				locale: params.locale,
				key: params.key,
				value: params.value,
				valueType,
			});
		}
	}

	// 刷新缓存
	await refreshUITranslationCache(params.locale);

	return { success: true };
}

/** UI 翻译删除 */
export async function deleteUITranslation(id: string): Promise<boolean> {
	const [existing] = await db
		.select()
		.from(uiTranslation)
		.where(eq(uiTranslation.id, id))
		.limit(1);
	if (!existing) return false;

	await db.delete(uiTranslation).where(eq(uiTranslation.id, id));
	await refreshUITranslationCache(existing.locale as Locale);

	return true;
}

// ═══════════════════════════════════════════════════
// UI 翻译导出 / 导入
// ═══════════════════════════════════════════════════

/** UI 翻译导出数据格式 */
export interface UiTranslationExportData {
	translations: {
		locale: string;
		key: string;
		value: string;
		valueType: string;
	}[];
}

/** 翻译导入返回值 */
export interface TranslationImportResult {
	created: number;
	updated: number;
}

/** 获取所有 UI 翻译（用于导出） */
export async function getAllUITranslationsForExport(): Promise<
	UiTranslationExportData["translations"]
> {
	const rows = await db
		.select()
		.from(uiTranslation)
		.orderBy(uiTranslation.locale, uiTranslation.key);
	return rows.map((row) => ({
		locale: row.locale,
		key: row.key,
		value: row.value,
		valueType: row.valueType,
	}));
}

/** 导入 UI 翻译（逐个 upsert） */
export async function importUiTranslations(
	data: UiTranslationExportData,
): Promise<TranslationImportResult> {
	let created = 0;
	let updated = 0;

	const affectedLocales = new Set<string>();

	for (const item of data.translations) {
		if (!EDITOR_TYPES.includes(item.valueType as EditorType)) {
			item.valueType = "input";
		}

		const [existing] = await db
			.select()
			.from(uiTranslation)
			.where(
				and(
					eq(uiTranslation.locale, item.locale),
					eq(uiTranslation.key, item.key),
				),
			)
			.limit(1);

		if (existing) {
			await db
				.update(uiTranslation)
				.set({
					value: item.value,
					valueType: item.valueType,
					updatedAt: new Date(),
				})
				.where(eq(uiTranslation.id, existing.id));
			updated++;
		} else {
			await db.insert(uiTranslation).values({
				locale: item.locale,
				key: item.key,
				value: item.value,
				valueType: item.valueType,
			});
			created++;
		}

		affectedLocales.add(item.locale);
	}

	// 刷新受影响语言的缓存
	for (const locale of affectedLocales) {
		await refreshUITranslationCache(locale as Locale);
	}

	return { created, updated };
}
