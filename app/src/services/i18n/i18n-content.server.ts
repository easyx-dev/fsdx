/**
 * 实体字段翻译模块：contentTranslation 表的查询、维护、导出与导入
 * 翻译按需查询（单条/批量/按字段），合并到主表记录后覆盖对应字段值
 */
import { DEFAULT_LOCALE, type Locale } from "@fsdx/core/i18n-types";
import { and, eq, inArray, like, or, type SQLWrapper } from "drizzle-orm";
import { EDITOR_TYPES, type EditorType } from "#/constants/editor-types";
import { db, withTransaction } from "#/db/index";
import { contentTranslation } from "#/db/schema";
import { refreshConfigTranslationCache } from "#/services/config/config.server";
import {
	buildSortClause,
	executePaginatedQuery,
	paginationOffset,
} from "#/services/query/query-utils.server";
import type { PaginatedSortParams } from "#/types/query";
import type { TranslationImportResult } from "./i18n-ui.server";

// ═══════════════════════════════════════════════════
// 实体翻译导出 / 导入
// ═══════════════════════════════════════════════════

/** 实体翻译导出数据格式 */
export interface ContentTranslationExportData {
	translations: {
		entityType: string;
		entityId: string;
		fieldName: string;
		locale: string;
		value: string;
		valueType: string;
	}[];
}

/** 获取所有实体翻译（用于导出） */
export async function getAllContentTranslationsForExport(): Promise<
	ContentTranslationExportData["translations"]
> {
	const rows = await db
		.select()
		.from(contentTranslation)
		.orderBy(
			contentTranslation.entityType,
			contentTranslation.entityId,
			contentTranslation.fieldName,
			contentTranslation.locale,
		);
	return rows.map((row) => ({
		entityType: row.entityType,
		entityId: row.entityId,
		fieldName: row.fieldName,
		locale: row.locale,
		value: row.value,
		valueType: row.valueType,
	}));
}

/** 导入实体翻译（逐个 upsert，在事务中完成） */
export async function importContentTranslations(
	data: ContentTranslationExportData,
): Promise<TranslationImportResult> {
	let created = 0;
	let updated = 0;

	await withTransaction(async (tx) => {
		for (const item of data.translations) {
			if (!EDITOR_TYPES.includes(item.valueType as EditorType)) {
				item.valueType = "text";
			}

			const [existing] = await tx
				.select()
				.from(contentTranslation)
				.where(
					and(
						eq(contentTranslation.entityType, item.entityType),
						eq(contentTranslation.entityId, item.entityId),
						eq(contentTranslation.fieldName, item.fieldName),
						eq(contentTranslation.locale, item.locale),
					),
				)
				.limit(1);

			if (existing) {
				await tx
					.update(contentTranslation)
					.set({
						value: item.value,
						valueType: item.valueType,
						updatedAt: new Date(),
					})
					.where(eq(contentTranslation.id, existing.id));
				updated++;
			} else {
				await tx.insert(contentTranslation).values({
					entityType: item.entityType,
					entityId: item.entityId,
					fieldName: item.fieldName,
					locale: item.locale,
					value: item.value,
					valueType: item.valueType,
				});
				created++;
			}
		}
	});

	return { created, updated };
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
		const [existing] = await db
			.select()
			.from(contentTranslation)
			.where(
				and(
					eq(contentTranslation.entityType, params.entityType),
					eq(contentTranslation.entityId, params.entityId),
					eq(contentTranslation.fieldName, params.fieldName),
					eq(contentTranslation.locale, params.locale),
				),
			)
			.limit(1);
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
