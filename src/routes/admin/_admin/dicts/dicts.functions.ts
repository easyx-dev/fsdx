/**
 * 字典管理路由共享 Server Function
 */

import { createServerFn } from "@tanstack/react-start";
import { toJson } from "#/lib/export/export.utils";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import {
	createDict,
	deleteDict,
	getDictList,
	loadDictCache,
} from "#/services/dict/dict.server";
import { logCrud } from "#/services/operation-log/operation-log.server";
import {
	createDictSchema,
	createItemSchema,
	dictImportSchema,
	dictSlugSchema,
	idSchema,
	updateDictSchema,
	updateItemSchema,
} from "./dicts.schemas";
import {
	createDictItemData,
	deleteDictItemRecord,
	exportAllDicts,
	getDictItems,
	importDicts,
	updateDictItemRecord,
	updateDictRecord,
} from "./dicts.server";

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
		return getDictItems(dictSlug);
	});

/** 创建字典类型 */
export const createDictSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.DICT_CREATE)])
	.inputValidator(createDictSchema)
	.handler(async ({ data, context }) => {
		const result = await createDict(data);
		logCrud(context.user, "dict", "create", {
			id: result.id,
			name: result.name,
		});
		return { success: true };
	});

/** 更新字典类型 */
export const updateDictSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.DICT_EDIT)])
	.inputValidator(updateDictSchema)
	.handler(async ({ data, context }) => {
		const { id, ...rest } = data;
		const updated = await updateDictRecord(id, rest);
		if (updated) {
			await loadDictCache();
		}
		logCrud(context.user, "dict", "update", { id: data.id });
		return { success: true };
	});

/** 删除字典类型 */
export const deleteDictSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.DICT_DELETE)])
	.inputValidator(idSchema)
	.handler(async ({ data: { id }, context }) => {
		await deleteDict(id);
		logCrud(context.user, "dict", "delete", { id: id });
		return { success: true };
	});

/** 创建字典条目 */
export const createDictItemSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.DICT_CREATE_ITEM)])
	.inputValidator(createItemSchema)
	.handler(async ({ data, context }) => {
		const result = await createDictItemData(data);
		await loadDictCache();
		logCrud(
			context.user,
			"dict",
			"create",
			{ id: result.id, name: `${data.dictSlug}:${data.label}` },
			{ targetType: "dict_item" },
		);
		return { success: true };
	});

/** 更新字典条目 */
export const updateDictItemSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.DICT_EDIT_ITEM)])
	.inputValidator(updateItemSchema)
	.handler(async ({ data, context }) => {
		const { id, ...rest } = data;
		const updated = await updateDictItemRecord(id, rest);
		if (updated) {
			await loadDictCache();
		}
		logCrud(
			context.user,
			"dict",
			"update",
			{ id: data.id },
			{ targetType: "dict_item" },
		);
		return { success: true };
	});

/** 删除字典条目 */
export const deleteDictItemSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.DICT_DELETE_ITEM)])
	.inputValidator(idSchema)
	.handler(async ({ data: { id }, context }) => {
		const success = await deleteDictItemRecord(id);
		if (success) {
			await loadDictCache();
		}
		logCrud(
			context.user,
			"dict",
			"delete",
			{ id: id },
			{ targetType: "dict_item" },
		);
		return { success: true };
	});

/** 导出字典数据（树形 JSON） */
export const exportDictsSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.DICT_EXPORT)])
	.handler(async () => {
		const tree = await exportAllDicts();
		return toJson(tree);
	});

/** 字典导入数据结构 */
export interface DictImportData {
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

export interface DictImportResult {
	dictsCreated: number;
	dictsUpdated: number;
	itemsCreated: number;
	itemsUpdated: number;
	itemsSkipped: number;
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
		logCrud(context.user, "dict", "import", undefined, {
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
