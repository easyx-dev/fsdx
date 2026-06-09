/**
 * 国际化服务端：UI 翻译 / 实体字段翻译的查询与维护
 * 内存缓存全量 UI 翻译，实体字段翻译按需查询
 */
import { and, eq, like, or } from "drizzle-orm";
import { db } from "#/db/index";
import { contentTranslation, uiTranslation } from "#/db/schema";
import { uiTranslationCache } from "#/lib/cache/cache";
import type { EditorType } from "#/lib/editor-types/editor-types";
import type { Locale } from "#/lib/i18n/i18n.types";
import { DEFAULT_LOCALE } from "#/lib/i18n/i18n.types";
import { logger } from "#/lib/logger/logger";

import { refreshConfigTranslationCache } from "#/server/config/config.server";
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
export interface ListUITranslationsParams {
	locale?: Locale;
	keyword?: string;
	page?: number;
	pageSize?: number;
}

/** UI 翻译列表 */
export async function listUITranslations(params?: ListUITranslationsParams) {
	const { locale, keyword, page = 1, pageSize = 20 } = params ?? {};
	const offset = (page - 1) * pageSize;

	const conditions = [];
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

	const [records, total] = await Promise.all([
		db
			.select()
			.from(uiTranslation)
			.where(whereCondition)
			.limit(pageSize)
			.offset(offset),
		db.$count(db.select().from(uiTranslation).where(whereCondition)),
	]);

	return { records, total, page, pageSize };
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
		const existing = await db.query.uiTranslation.findFirst({
			where: and(
				eq(uiTranslation.locale, params.locale),
				eq(uiTranslation.key, params.key),
			),
		});
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
	logger.info({ locale: params.locale, key: params.key }, "UI 翻译已更新");

	return { success: true };
}

/** UI 翻译删除 */
export async function deleteUITranslation(id: string): Promise<boolean> {
	const existing = await db.query.uiTranslation.findFirst({
		where: eq(uiTranslation.id, id),
	});
	if (!existing) return false;

	await db.delete(uiTranslation).where(eq(uiTranslation.id, id));
	await refreshUITranslationCache(existing.locale as Locale);
	logger.info({ id, key: existing.key }, "UI 翻译已删除");

	return true;
}

// ═══════════════════════════════════════════════════
// 实体字段翻译查询
// ═══════════════════════════════════════════════════

/** 实体字段翻译查询结果 */
export interface ContentTranslationResult {
	fieldName: string;
	value: string;
	valueType: EditorType;
}

/**
 * 查询某个实体的所有字段翻译
 * 返回 { fieldName: value } 映射，可直接覆盖主表查询结果
 */
export async function getContentTranslations(
	entityType: string,
	entityId: string,
	locale: Locale,
): Promise<Record<string, ContentTranslationResult>> {
	if (locale === DEFAULT_LOCALE) return {};

	const rows = await db
		.select()
		.from(contentTranslation)
		.where(
			and(
				eq(contentTranslation.entityType, entityType),
				eq(contentTranslation.entityId, entityId),
				eq(contentTranslation.locale, locale),
			),
		);

	const result: Record<string, ContentTranslationResult> = {};
	for (const row of rows) {
		result[row.fieldName] = {
			fieldName: row.fieldName,
			value: row.value,
			valueType: row.valueType as EditorType,
		};
	}

	return result;
}

/**
 * 获取某实体某个字段的所有语言翻译（管理端抽屉用）
 */
export async function getFieldTranslations(
	entityType: string,
	entityId: string,
	fieldName: string,
): Promise<Record<string, ContentTranslationResult>> {
	const rows = await db
		.select()
		.from(contentTranslation)
		.where(
			and(
				eq(contentTranslation.entityType, entityType),
				eq(contentTranslation.entityId, entityId),
				eq(contentTranslation.fieldName, fieldName),
			),
		);

	const result: Record<string, ContentTranslationResult> = {};
	for (const row of rows) {
		result[row.locale] = {
			fieldName: row.fieldName,
			value: row.value,
			valueType: row.valueType as EditorType,
		};
	}

	return result;
}

// ═══════════════════════════════════════════════════
// 实体字段翻译维护
// ═══════════════════════════════════════════════════

/** 实体翻译列表查询参数 */
export interface ListContentTranslationsParams {
	entityType?: string;
	locale?: Locale;
	keyword?: string;
	page?: number;
	pageSize?: number;
}

/** 实体翻译列表 */
export async function listContentTranslations(
	params?: ListContentTranslationsParams,
) {
	const { entityType, locale, keyword, page = 1, pageSize = 20 } = params ?? {};
	const offset = (page - 1) * pageSize;

	const conditions = [];
	if (entityType)
		conditions.push(eq(contentTranslation.entityType, entityType));
	if (locale) conditions.push(eq(contentTranslation.locale, locale));
	if (keyword) {
		conditions.push(
			or(
				like(contentTranslation.fieldName, `%${keyword}%`),
				like(contentTranslation.value, `%${keyword}%`),
			),
		);
	}

	const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

	const [records, total] = await Promise.all([
		db
			.select()
			.from(contentTranslation)
			.where(whereCondition)
			.limit(pageSize)
			.offset(offset),
		db.$count(db.select().from(contentTranslation).where(whereCondition)),
	]);

	return { records, total, page, pageSize };
}

/** 实体翻译创建或更新（基于 entityType + entityId + fieldName + locale 唯一约束） */
export async function upsertContentTranslation(params: {
	id?: string;
	entityType: string;
	entityId: string;
	fieldName: string;
	locale: Locale;
	value: string;
	valueType?: EditorType;
}) {
	const valueType: EditorType = params.valueType ?? "text";

	if (params.id) {
		await db
			.update(contentTranslation)
			.set({
				entityType: params.entityType,
				entityId: params.entityId,
				fieldName: params.fieldName,
				locale: params.locale,
				value: params.value,
				valueType,
				updatedAt: new Date(),
			})
			.where(eq(contentTranslation.id, params.id));
	} else {
		const existing = await db.query.contentTranslation.findFirst({
			where: and(
				eq(contentTranslation.entityType, params.entityType),
				eq(contentTranslation.entityId, params.entityId),
				eq(contentTranslation.fieldName, params.fieldName),
				eq(contentTranslation.locale, params.locale),
			),
		});
		if (existing) {
			await db
				.update(contentTranslation)
				.set({ value: params.value, valueType, updatedAt: new Date() })
				.where(eq(contentTranslation.id, existing.id));
		} else {
			await db.insert(contentTranslation).values({
				entityType: params.entityType,
				entityId: params.entityId,
				fieldName: params.fieldName,
				locale: params.locale,
				value: params.value,
				valueType,
			});
		}
	}

	logger.info(
		{
			entityType: params.entityType,
			entityId: params.entityId,
			fieldName: params.fieldName,
			locale: params.locale,
		},
		"实体翻译已更新",
	);

	// 系统配置翻译变更时刷新对应缓存
	if (params.entityType === "system_config") {
		await refreshConfigTranslationCache(params.locale);
	}

	return { success: true };
}

/** 实体翻译删除 */
export async function deleteContentTranslation(id: string): Promise<boolean> {
	const existing = await db.query.contentTranslation.findFirst({
		where: eq(contentTranslation.id, id),
	});
	if (!existing) return false;

	await db.delete(contentTranslation).where(eq(contentTranslation.id, id));
	logger.info(
		{ id, entityType: existing.entityType, fieldName: existing.fieldName },
		"实体翻译已删除",
	);

	// 系统配置翻译删除时刷新对应缓存
	if (existing.entityType === "system_config" && existing.locale) {
		await refreshConfigTranslationCache(existing.locale as Locale);
	}

	return true;
}
