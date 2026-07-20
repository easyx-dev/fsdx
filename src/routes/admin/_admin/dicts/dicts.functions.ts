/**
 * 字典管理路由共享 Server Function
 */

import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "#/db/index";
import { dict, dictItem } from "#/db/schema";
import { PRESET_DICTS } from "#/lib/constants/admin-constants";
import { toJson } from "#/lib/export/export.utils";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import {
	createDict,
	deleteDict,
	getDictList,
	loadDictCache,
} from "#/server/dict/dict.server";
import { logOperation } from "#/server/operation-log/operation-log.server";
import {
	createDictSchema,
	createItemSchema,
	dictImportSchema,
	dictSlugSchema,
	idSchema,
	updateDictSchema,
	updateItemSchema,
} from "./dicts.schemas";

/** 获取字典列表 */
export const getDictListSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.DICT_VIEW)])
	.handler(async () => {
		return getDictList();
	});

/** 获取字典条目列表 */
export const getDictItemsSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.DICT_VIEW)])
	.inputValidator(dictSlugSchema)
	.handler(async ({ data: { dictSlug } }) => {
		return db
			.select()
			.from(dictItem)
			.where(and(isNull(dictItem.deletedAt), eq(dictItem.dictSlug, dictSlug)))
			.orderBy(asc(dictItem.sortOrder));
	});

/** 创建字典类型 */
export const createDictSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.DICT_CREATE)])
	.inputValidator(createDictSchema)
	.handler(async ({ data, context }) => {
		const result = await createDict(data);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "dict",
			action: "create",
			targetType: "dict",
			targetId: result.id,
			targetName: result.name,
		});
		return { success: true };
	});

/** 更新字典类型 */
export const updateDictSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.DICT_EDIT)])
	.inputValidator(updateDictSchema)
	.handler(async ({ data, context }) => {
		const { id, ...rest } = data;
		const existing = await db.query.dict.findFirst({ where: eq(dict.id, id) });
		if (existing) {
			// 预置字典 slug 不允许修改
			if (
				rest.slug &&
				rest.slug !== existing.slug &&
				PRESET_DICTS.some((d) => d.slug === existing.slug)
			) {
				throw new Error("预置字典的标识(slug)不允许修改");
			}
			const [updated] = await db
				.update(dict)
				.set({ ...rest, updatedAt: new Date() })
				.where(eq(dict.id, id))
				.returning();
			if (updated) {
				await loadDictCache();
			}
		}
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "dict",
			action: "update",
			targetType: "dict",
			targetId: data.id,
		});
		return { success: true };
	});

/** 删除字典类型 */
export const deleteDictSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.DICT_DELETE)])
	.inputValidator(idSchema)
	.handler(async ({ data: { id }, context }) => {
		await deleteDict(id);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "dict",
			action: "delete",
			targetType: "dict",
			targetId: id,
		});
		return { success: true };
	});

/** 创建字典条目 */
export const createDictItemSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.DICT_CREATE_ITEM)])
	.inputValidator(createItemSchema)
	.handler(async ({ data, context }) => {
		const [result] = await db.insert(dictItem).values(data).returning();
		await loadDictCache();
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "dict",
			action: "create",
			targetType: "dict_item",
			targetId: result.id,
			targetName: `${data.dictSlug}:${data.label}`,
		});
		return { success: true };
	});

/** 更新字典条目 */
export const updateDictItemSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.DICT_EDIT_ITEM)])
	.inputValidator(updateItemSchema)
	.handler(async ({ data, context }) => {
		const { id, ...rest } = data;
		// 预置字典条目的 value 不允许修改
		if (rest.value) {
			const item = await db.query.dictItem.findFirst({
				where: eq(dictItem.id, id),
			});
			if (item && PRESET_DICTS.some((d) => d.slug === item.dictSlug)) {
				throw new Error("预置字典条目的值(value)不允许修改");
			}
		}
		const [updated] = await db
			.update(dictItem)
			.set({ ...rest, updatedAt: new Date() })
			.where(eq(dictItem.id, id))
			.returning();
		if (updated) {
			await loadDictCache();
		}
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "dict",
			action: "update",
			targetType: "dict_item",
			targetId: data.id,
		});
		return { success: true };
	});

/** 删除字典条目 */
export const deleteDictItemSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.DICT_DELETE_ITEM)])
	.inputValidator(idSchema)
	.handler(async ({ data: { id }, context }) => {
		const existing = await db.query.dictItem.findFirst({
			where: eq(dictItem.id, id),
		});
		if (existing) {
			// 预置字典条目不允许删除
			if (PRESET_DICTS.some((d) => d.slug === existing.dictSlug)) {
				throw new Error("预置字典条目不允许删除");
			}
			await db
				.update(dictItem)
				.set({ deletedAt: new Date() })
				.where(eq(dictItem.id, id));
			await loadDictCache();
		}
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "dict",
			action: "delete",
			targetType: "dict_item",
			targetId: id,
		});
		return { success: true };
	});

/** 导出字典数据（树形 JSON） */
export const exportDictsSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.DICT_EXPORT)])
	.handler(async () => {
		const [dicts, dictItems] = await Promise.all([
			db
				.select()
				.from(dict)
				.where(isNull(dict.deletedAt))
				.orderBy(asc(dict.createdAt)),
			db
				.select()
				.from(dictItem)
				.where(isNull(dictItem.deletedAt))
				.orderBy(asc(dictItem.dictSlug), asc(dictItem.sortOrder)),
		]);
		const tree = dicts.map((d) => ({
			name: d.name,
			slug: d.slug,
			description: d.description,
			children: dictItems.filter((i) => i.dictSlug === d.slug),
		}));
		return toJson({ dicts: tree });
	});

/** 字典导入数据结构 */
interface DictImportData {
	dicts: { name: string; slug: string; description?: string | null }[];
	dictItems: {
		dictSlug: string;
		label: string;
		value: string;
		sortOrder?: number;
		status?: string;
		extraType?: string | null;
		extra?: string | null;
		color?: string | null;
	}[];
}

interface DictImportResult {
	dictsCreated: number;
	dictsUpdated: number;
	itemsCreated: number;
	itemsUpdated: number;
	itemsSkipped: number;
}

/** 导入字典数据（事务中 upsert） */
async function importDicts(data: DictImportData): Promise<DictImportResult> {
	const result: DictImportResult = {
		dictsCreated: 0,
		dictsUpdated: 0,
		itemsCreated: 0,
		itemsUpdated: 0,
		itemsSkipped: 0,
	};

	await db.transaction(async (tx) => {
		const importedSlugs = new Set(data.dicts.map((d) => d.slug));
		const existingDicts = await tx
			.select({ slug: dict.slug })
			.from(dict)
			.where(isNull(dict.deletedAt));
		for (const d of existingDicts) importedSlugs.add(d.slug);

		for (const d of data.dicts) {
			const existing = await tx.query.dict.findFirst({
				where: and(eq(dict.slug, d.slug), isNull(dict.deletedAt)),
			});
			if (existing) {
				await tx
					.update(dict)
					.set({
						name: d.name,
						description: d.description ?? existing.description,
						updatedAt: new Date(),
					})
					.where(eq(dict.id, existing.id));
				result.dictsUpdated++;
			} else {
				await tx.insert(dict).values({
					name: d.name,
					slug: d.slug,
					description: d.description,
				});
				result.dictsCreated++;
			}
		}

		for (const item of data.dictItems) {
			if (!importedSlugs.has(item.dictSlug)) {
				result.itemsSkipped++;
				continue;
			}
			const existing = await tx.query.dictItem.findFirst({
				where: and(
					eq(dictItem.dictSlug, item.dictSlug),
					eq(dictItem.value, item.value),
					isNull(dictItem.deletedAt),
				),
			});
			if (existing) {
				await tx
					.update(dictItem)
					.set({
						label: item.label,
						sortOrder: item.sortOrder ?? existing.sortOrder,
						status: item.status ?? existing.status,
						extraType: item.extraType ?? existing.extraType,
						extra: item.extra ?? existing.extra,
						color: item.color ?? existing.color,
						updatedAt: new Date(),
					})
					.where(eq(dictItem.id, existing.id));
				result.itemsUpdated++;
			} else {
				await tx.insert(dictItem).values({
					dictSlug: item.dictSlug,
					label: item.label,
					value: item.value,
					sortOrder: item.sortOrder ?? 0,
					status: item.status ?? "active",
					extraType: item.extraType ?? null,
					extra: item.extra ?? null,
					color: item.color ?? null,
				});
				result.itemsCreated++;
			}
		}
	});

	return result;
}

/** 导入字典数据（树形 JSON，自动展平为内部格式） */
export const importDictsSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.DICT_IMPORT)])
	.inputValidator(dictImportSchema)
	.handler(async ({ data, context }) => {
		const flat: DictImportData = {
			dicts: data.dicts.map(({ children: _, ...rest }) => rest),
			dictItems: data.dicts.flatMap((d) =>
				(d.children ?? []).map((item) => ({ ...item, dictSlug: d.slug })),
			),
		};
		const result = await importDicts(flat);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "dict",
			action: "import",
			targetType: "dict",
			detail: {
				dictsCreated: result.dictsCreated,
				dictsUpdated: result.dictsUpdated,
				itemsCreated: result.itemsCreated,
				itemsUpdated: result.itemsUpdated,
				itemsSkipped: result.itemsSkipped,
			},
		});
		return result;
	});
