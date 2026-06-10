/**
 * 字典管理：CRUD 操作 + 内存缓存
 */
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "#/db/index";
import { dict, dictItem } from "#/db/schema";
import { dictCache } from "#/lib/cache/cache";
import { PRESET_DICTS } from "#/lib/constants/admin-constants";
import { logger } from "#/lib/logger/logger";

export type DictRecord = typeof dict.$inferSelect;
export type DictItemRecord = typeof dictItem.$inferSelect;

let cacheLoaded = false;

async function ensureCache(): Promise<void> {
	if (!cacheLoaded) {
		await loadDictCache();
		cacheLoaded = true;
	}
}

function invalidateCache(): void {
	cacheLoaded = false;
}

export async function loadDictCache(): Promise<void> {
	const [dicts, items] = await Promise.all([
		db.select().from(dict).where(isNull(dict.deletedAt)),
		db
			.select({
				slug: dict.slug,
				label: dictItem.label,
				value: dictItem.value,
				color: dictItem.color,
			})
			.from(dictItem)
			.innerJoin(dict, eq(dictItem.dictSlug, dict.slug))
			.where(isNull(dictItem.deletedAt))
			.orderBy(asc(dictItem.sortOrder)),
	]);
	dictCache.clear();
	for (const d of dicts) dictCache.set(d.slug, {});
	for (const item of items) {
		const map = dictCache.get(item.slug) || {};
		map[item.value] = { label: item.label, color: item.color };
		dictCache.set(item.slug, map);
	}
	cacheLoaded = true;
	logger.info({ count: dicts.length }, "字典缓存加载完成");
}

export async function getDictLabel(
	slug: string,
	value: string,
): Promise<string> {
	await ensureCache();
	const map = dictCache.get(slug);
	return map?.[value]?.label ?? value;
}

export async function getDictMap(
	slug: string,
): Promise<Record<string, string>> {
	await ensureCache();
	const map = dictCache.get(slug);
	if (!map) return {};
	const result: Record<string, string> = {};
	for (const [value, info] of Object.entries(map)) {
		result[value] = info.label;
	}
	return result;
}

/** 字典选项（供 UI Select/Segmented/Tag 使用） */
export interface DictOption {
	label: string;
	value: string;
	color?: string | null;
}

/** 获取指定字典的所有条目选项（含颜色） */
export async function getDictOptions(slug: string): Promise<DictOption[]> {
	await ensureCache();
	const map = dictCache.get(slug);
	if (!map) return [];
	return Object.entries(map).map(([value, info]) => ({
		label: info.label,
		value,
		color: info.color,
	}));
}

/** 获取全部字典选项（按 slug 分组，供 zustand store 一次性加载） */
export async function getAllDictOptions(): Promise<
	Record<string, DictOption[]>
> {
	await ensureCache();
	const result: Record<string, DictOption[]> = {};
	for (const slug of dictCache.keys()) {
		const map = dictCache.get(slug);
		if (map) {
			result[slug] = Object.entries(map).map(([value, info]) => ({
				label: info.label,
				value,
				color: info.color,
			}));
		}
	}
	return result;
}

export async function getDictList() {
	return db
		.select()
		.from(dict)
		.where(isNull(dict.deletedAt))
		.orderBy(asc(dict.createdAt));
}

export async function createDict(params: {
	name: string;
	slug: string;
	description?: string;
}) {
	const [record] = await db.insert(dict).values(params).returning();
	dictCache.set(record.slug, {});
	logger.info({ slug: record.slug }, "字典类型已创建");
	return record;
}

export async function updateDict(
	id: string,
	params: { name?: string; slug?: string; description?: string },
) {
	const existing = await db.query.dict.findFirst({ where: eq(dict.id, id) });
	if (!existing) return null;

	// 预置字典 slug 不允许修改
	if (
		params.slug &&
		params.slug !== existing.slug &&
		PRESET_DICTS.some((d) => d.slug === existing.slug)
	) {
		throw new Error("预置字典的标识(slug)不允许修改");
	}

	// slug 变更时在事务中更新（ON UPDATE CASCADE 自动级联 dictItem）
	if (params.slug && params.slug !== existing.slug) {
		const [updated] = await db
			.update(dict)
			.set({ ...params, updatedAt: new Date() })
			.where(eq(dict.id, id))
			.returning();
		if (updated) {
			invalidateCache();
			await loadDictCache();
			logger.info(
				{ slug: updated.slug, oldSlug: existing.slug },
				"字典 slug 已更新",
			);
		}
		return updated ?? null;
	}

	const [updated] = await db
		.update(dict)
		.set({ ...params, updatedAt: new Date() })
		.where(eq(dict.id, id))
		.returning();
	if (updated) {
		invalidateCache();
		await loadDictCache();
	}
	return updated ?? null;
}

export async function deleteDict(id: string) {
	const existing = await db.query.dict.findFirst({ where: eq(dict.id, id) });
	if (!existing) return false;

	// 预置字典不允许删除
	if (PRESET_DICTS.some((d) => d.slug === existing.slug)) {
		throw new Error("预置字典不允许删除");
	}

	const now = new Date();
	await db.transaction(async (tx) => {
		await tx
			.update(dictItem)
			.set({ deletedAt: now })
			.where(eq(dictItem.dictSlug, existing.slug));
		await tx.update(dict).set({ deletedAt: now }).where(eq(dict.id, id));
	});
	invalidateCache();
	await loadDictCache();
	logger.info({ slug: existing.slug }, "字典类型已删除");
	return true;
}

export async function getDictItemList(dictSlug: string) {
	return db
		.select()
		.from(dictItem)
		.where(and(isNull(dictItem.deletedAt), eq(dictItem.dictSlug, dictSlug)))
		.orderBy(asc(dictItem.sortOrder));
}

export async function createDictItem(params: {
	dictSlug: string;
	label: string;
	value: string;
	sortOrder?: number;
	extraType?: string;
	extra?: string;
	color?: string;
}) {
	const [record] = await db.insert(dictItem).values(params).returning();
	invalidateCache();
	await loadDictCache();
	return record;
}

export async function updateDictItem(
	id: string,
	params: {
		label?: string;
		value?: string;
		sortOrder?: number;
		status?: string;
		extraType?: string;
		extra?: string;
		color?: string;
	},
) {
	// 预置字典条目的 value 不允许修改
	if (params.value) {
		const item = await db.query.dictItem.findFirst({
			where: eq(dictItem.id, id),
		});
		if (item && PRESET_DICTS.some((d) => d.slug === item.dictSlug)) {
			throw new Error("预置字典条目的值(value)不允许修改");
		}
	}

	const [updated] = await db
		.update(dictItem)
		.set({ ...params, updatedAt: new Date() })
		.where(eq(dictItem.id, id))
		.returning();
	if (updated) {
		invalidateCache();
		await loadDictCache();
	}
	return updated ?? null;
}

export async function deleteDictItem(id: string) {
	const existing = await db.query.dictItem.findFirst({
		where: eq(dictItem.id, id),
	});
	if (!existing) return false;

	// 预置字典条目不允许删除
	if (PRESET_DICTS.some((d) => d.slug === existing.dictSlug)) {
		throw new Error("预置字典条目不允许删除");
	}

	await db
		.update(dictItem)
		.set({ deletedAt: new Date() })
		.where(eq(dictItem.id, id));
	invalidateCache();
	await loadDictCache();
	return true;
}

// ========== 预置字典 ==========

/** 运行时校验并插入缺失的预置字典（幂等安全） */
export async function ensurePresetDicts(): Promise<void> {
	for (const preset of PRESET_DICTS) {
		const existingDict = await db.query.dict.findFirst({
			where: eq(dict.slug, preset.slug),
		});
		if (existingDict) continue;

		const [newDict] = await db
			.insert(dict)
			.values({ name: preset.name, slug: preset.slug })
			.returning();

		for (const item of preset.items) {
			await db.insert(dictItem).values({
				dictSlug: newDict.slug,
				label: item.label,
				value: item.value,
				sortOrder: item.sortOrder,
				color: item.color ?? null,
				extraType: item.extraType ?? null,
				extra: item.extra ?? null,
			});
		}
		logger.info({ slug: preset.slug }, "预置字典已创建");
	}
}

// ========== 导出 / 导入 ==========

/** 获取所有未删除的字典类型（用于导出） */
export async function getAllDictsForExport(): Promise<DictRecord[]> {
	return db
		.select()
		.from(dict)
		.where(isNull(dict.deletedAt))
		.orderBy(asc(dict.createdAt));
}

/** 获取所有未删除的字典条目（用于导出） */
export async function getAllDictItemsForExport(): Promise<DictItemRecord[]> {
	return db
		.select()
		.from(dictItem)
		.where(isNull(dictItem.deletedAt))
		.orderBy(asc(dictItem.dictSlug), asc(dictItem.sortOrder));
}

/** 字典导入数据格式 */
export interface DictImportData {
	dicts: {
		name: string;
		slug: string;
		description?: string | null;
	}[];
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

/** 字典导入返回值 */
export interface DictImportResult {
	dictsCreated: number;
	dictsUpdated: number;
	itemsCreated: number;
	itemsUpdated: number;
	itemsSkipped: number;
}

/** 导入字典数据（在事务中 upsert） */
export async function importDicts(
	data: DictImportData,
): Promise<DictImportResult> {
	const result: DictImportResult = {
		dictsCreated: 0,
		dictsUpdated: 0,
		itemsCreated: 0,
		itemsUpdated: 0,
		itemsSkipped: 0,
	};

	await db.transaction(async (tx) => {
		// 收集所有有效的 dictSlug（导入数据 + 数据库已有）
		const importedSlugs = new Set(data.dicts.map((d) => d.slug));
		const existingDicts = await tx
			.select({ slug: dict.slug })
			.from(dict)
			.where(isNull(dict.deletedAt));
		for (const d of existingDicts) importedSlugs.add(d.slug);

		// Upsert 字典类型
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

		// Upsert 字典条目
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

	logger.info(result, "字典导入完成");
	await loadDictCache();
	return result;
}
