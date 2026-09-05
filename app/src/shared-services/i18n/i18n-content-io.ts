/**
 * 实体字段翻译的导入与导出：ContentTranslation 数据的批量导出与 upsert 导入
 * 供 i18n-content.server.ts 拆分发引用，独立成「导入导出」职责
 */
import { and, eq } from "drizzle-orm";
import { EDITOR_TYPES, type EditorType } from "#/constants/editor-types";
import { db, withTransaction } from "#/db/index";
import { contentTranslation } from "#/db/schema";
import type { TranslationImportResult } from "./i18n-ui.server";

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
