/**
 * 字典管理 Server Function 包装器：导出 / 导入
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toJson } from "#/lib/export/export.utils";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import {
	type DictImportData,
	type DictImportResult,
	getAllDictItemsForExport,
	getAllDictOptions,
	getAllDictsForExport,
	importDicts,
} from "#/server/dict/dict.server";
import { logOperation } from "#/server/operation-log/operation-log.server";

/** 树形结构中的条目 schema（不含 dictSlug，由父级继承） */
const treeDictItemSchema = z.object({
	label: z.string().min(1),
	value: z.string().min(1),
	sortOrder: z.number().optional(),
	status: z.string().optional(),
	extraType: z.string().nullable().optional(),
	extra: z.string().nullable().optional(),
	color: z.string().nullable().optional(),
});

/** 树形导入 schema：字典类型下嵌套 children */
const dictImportSchema = z.object({
	dicts: z.array(
		z.object({
			name: z.string().min(1),
			slug: z.string().min(1),
			description: z.string().nullable().optional(),
			children: z.array(treeDictItemSchema).optional().default([]),
		}),
	),
});

/** 导出字典数据（树形 JSON，dicts → children → items） */
export const exportDictsSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.DICT_EXPORT)])
	.handler(async () => {
		const [dicts, dictItems] = await Promise.all([
			getAllDictsForExport(),
			getAllDictItemsForExport(),
		]);
		const tree = dicts.map((d) => ({
			name: d.name,
			slug: d.slug,
			description: d.description,
			children: dictItems.filter((i) => i.dictSlug === d.slug),
		}));
		return toJson({ dicts: tree });
	});

/** 导入字典数据（树形 JSON，自动展平为内部格式） */
export const importDictsSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.DICT_IMPORT)])
	.inputValidator(z.object({ data: dictImportSchema }))
	.handler(async ({ data: { data }, context }): Promise<DictImportResult> => {
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

/** 获取全部字典选项（按 slug 分组，供 zustand store 一次性加载） */
export const getAllDictOptionsSFn = createServerFn({ method: "GET" }).handler(
	async () => {
		return getAllDictOptions();
	},
);
