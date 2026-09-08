/**
 * 实体字段翻译模块：contentTranslation 表的查询、维护、导出与导入
 * 翻译按需查询（单条/批量/按字段），合并到主表记录后覆盖对应字段值
 */

import { and, eq, inArray, like, or, type SQLWrapper } from "drizzle-orm";
import type { EditorType } from "#/constants/editor-types";
import { db } from "#/db/index";
import { contentTranslation } from "#/db/schema";
import { refreshConfigTranslationCache } from "#/shared-services/config/config.server";
import {
	buildSortClause,
	executePaginatedQuery,
	paginationOffset,
} from "#/shared-services/query/query-utils.server";
import type { PaginatedSortParams } from "#/types/query";
import { DEFAULT_LOCALE, type Locale } from "./i18n-types";

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
 * 将翻译数据合并到单条记录中，覆盖对应字段的值
 */
export function applyTranslations<T extends Record<string, unknown>>(
	record: T,
	translations: Record<string, ContentTranslationResult>,
): T;
/**
 * 批量将翻译数据合并到多条记录中（需传入按 entityId 分组的翻译 Map）
 */
export function applyTranslations<
	T extends Record<string, unknown> & { id: string },
>(
	records: T[],
	translationsMap: Record<string, Record<string, ContentTranslationResult>>,
): T[];
export function applyTranslations<
	T extends Record<string, unknown> & { id: string },
>(
	recordOrRecords: T | T[],
	translations:
		| Record<string, ContentTranslationResult>
		| Record<string, Record<string, ContentTranslationResult>>,
): T | T[] {
	if (Array.isArray(recordOrRecords)) {
		const map = translations as Record<
			string,
			Record<string, ContentTranslationResult>
		>;
		return recordOrRecords.map((record) => {
			const t = map[record.id];
			if (!t) return record;
			const result = { ...record };
			for (const [fieldName, ct] of Object.entries(t)) {
				(result as Record<string, unknown>)[fieldName] = ct.value;
			}
			return result;
		});
	}

	const t = translations as Record<string, ContentTranslationResult>;
	const result = { ...recordOrRecords };
	for (const [fieldName, ct] of Object.entries(t)) {
		(result as Record<string, unknown>)[fieldName] = ct.value;
	}
	return result;
}

/**
 * 查询某个实体的所有字段翻译（单 ID）
 * 返回 { fieldName: value } 映射，可直接覆盖主表查询结果
 */
export async function getContentTranslations(
	entityType: string,
	entityId: string,
	locale: Locale,
): Promise<Record<string, ContentTranslationResult>>;
/**
 * 批量查询多个实体的所有字段翻译（多 ID）
 * 返回按 entityId 分组的映射，可直接覆盖主表查询结果
 */
export async function getContentTranslations(
	entityType: string,
	entityIds: string[],
	locale: Locale,
): Promise<Record<string, Record<string, ContentTranslationResult>>>;
export async function getContentTranslations(
	entityType: string,
	entityIds: string | string[],
	locale: Locale,
): Promise<
	| Record<string, ContentTranslationResult>
	| Record<string, Record<string, ContentTranslationResult>>
> {
	if (locale === DEFAULT_LOCALE) {
		if (Array.isArray(entityIds)) return {};
		return {};
	}

	const idList = Array.isArray(entityIds) ? entityIds : [entityIds];

	const rows = await db
		.select()
		.from(contentTranslation)
		.where(
			and(
				eq(contentTranslation.entityType, entityType),
				inArray(contentTranslation.entityId, idList),
				eq(contentTranslation.locale, locale),
			),
		);

	if (Array.isArray(entityIds)) {
		const result: Record<string, Record<string, ContentTranslationResult>> = {};
		for (const row of rows) {
			if (!result[row.entityId]) result[row.entityId] = {};
			result[row.entityId][row.fieldName] = {
				fieldName: row.fieldName,
				value: row.value,
				valueType: row.valueType as EditorType,
			};
		}
		return result;
	}

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
 * 对单条记录应用内容翻译（按 entityType 查询并覆盖字段）
 * 默认语言直接返回原记录；非默认语言查询 content_translation 中实际存在的记录做合并，
 * 业务侧无需声明可翻译字段——存在即生效
 */
export async function translateRecord<
	T extends Record<string, unknown> & { id: string },
>(record: T, entityType: string, locale: Locale): Promise<T> {
	if (locale === DEFAULT_LOCALE) return record;
	const translations = await getContentTranslations(
		entityType,
		record.id,
		locale,
	);
	return applyTranslations(record, translations);
}

/**
 * 批量对记录应用内容翻译（一次查询按 entityId 分组，避免 N+1）
 * 默认语言或空数组直接返回原记录
 */
export async function translateRecords<
	T extends Record<string, unknown> & { id: string },
>(records: T[], entityType: string, locale: Locale): Promise<T[]> {
	if (locale === DEFAULT_LOCALE || records.length === 0) return records;
	const translationsMap = await getContentTranslations(
		entityType,
		records.map((r) => r.id),
		locale,
	);
	return applyTranslations(records, translationsMap);
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
export interface ListContentTranslationsParams extends PaginatedSortParams {
	entityType?: string;
	locale?: Locale;
	keyword?: string;
}

/** 实体翻译列表 */
export async function listContentTranslations(
	params?: ListContentTranslationsParams,
) {
	const {
		entityType,
		locale,
		keyword,
		page = 1,
		pageSize = 20,
		sortField,
		sortOrder,
	} = params ?? {};
	const offset = paginationOffset(page, pageSize);

	const conditions: (SQLWrapper | undefined)[] = [];
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

	const sortFieldMap = {
		fieldName: contentTranslation.fieldName,
		locale: contentTranslation.locale,
		entityType: contentTranslation.entityType,
		updatedAt: contentTranslation.updatedAt,
	};
	const direction = buildSortClause(
		sortFieldMap,
		sortField,
		sortOrder,
		"fieldName",
	);

	return executePaginatedQuery(
		db
			.select()
			.from(contentTranslation)
			.where(whereCondition)
			.orderBy(direction)
			.limit(pageSize)
			.offset(offset),
		db.$count(db.select().from(contentTranslation).where(whereCondition)),
		page,
		pageSize,
	);
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
		// 新建：基于 (entityType, entityId, fieldName, locale) 唯一约束做原子 upsert，
		// 避免并发 select-then-write 竞态
		await db
			.insert(contentTranslation)
			.values({
				entityType: params.entityType,
				entityId: params.entityId,
				fieldName: params.fieldName,
				locale: params.locale,
				value: params.value,
				valueType,
			})
			.onConflictDoUpdate({
				target: [
					contentTranslation.entityType,
					contentTranslation.entityId,
					contentTranslation.fieldName,
					contentTranslation.locale,
				],
				set: {
					value: params.value,
					valueType,
					updatedAt: new Date(),
				},
			});
	}

	// 系统配置翻译变更时刷新对应缓存
	if (params.entityType === "system_config") {
		await refreshConfigTranslationCache(params.locale);
	}

	return { success: true };
}

/** 实体翻译删除 */
export async function deleteContentTranslation(id: string): Promise<boolean> {
	const [existing] = await db
		.select()
		.from(contentTranslation)
		.where(eq(contentTranslation.id, id))
		.limit(1);
	if (!existing) return false;

	await db.delete(contentTranslation).where(eq(contentTranslation.id, id));

	// 系统配置翻译删除时刷新对应缓存
	if (existing.entityType === "system_config" && existing.locale) {
		await refreshConfigTranslationCache(existing.locale as Locale);
	}

	return true;
}
