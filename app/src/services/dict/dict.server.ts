/**
 * 字典管理：CRUD + 导入导出 + 内存缓存（领域实体唯一归属）
 */
import { and, asc, eq, isNull } from "drizzle-orm";
import { PRESET_DICTS } from "#/constants";
import { db, withTransaction } from "#/db/index";
import { dict, dictItem } from "#/db/schema";
import { logger } from "#/lib/logger/logger";
import { dictCache } from "#/services/dict/dict.cache";
import type { DictImportData, DictImportResult } from "./dict.types";

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

/** 字典选项（供 UI Select/Segmented/Tag 使用） */
export interface DictOption {
	label: string;
	value: string;
	color?: string | null;
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
	return record;
}

export async function deleteDict(id: string) {
	const [existing] = await db
		.select()
		.from(dict)
		.where(eq(dict.id, id))
		.limit(1);
	if (!existing) return false;

	// 预置字典不允许删除
	if (PRESET_DICTS.some((d) => d.slug === existing.slug)) {
		throw new Error("预置字典不允许删除");
	}

	const now = new Date();
	await withTransaction(async (tx) => {
		await tx
			.update(dictItem)
			.set({ deletedAt: now })
			.where(eq(dictItem.dictSlug, existing.slug));
		await tx.update(dict).set({ deletedAt: now }).where(eq(dict.id, id));
	});
	invalidateCache();
	await loadDictCache();
	return true;
}

// ========== 预置字典 ==========

/** 运行时校验并插入缺失的预置字典（幂等安全） */
export async function ensurePresetDicts(): Promise<void> {
	for (const preset of PRESET_DICTS) {
		const [existingDict] = await db
			.select()
			.from(dict)
			.where(eq(dict.slug, preset.slug))
			.limit(1);
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

// ========== 字典条目管理 ==========

/** 获取字典条目列表 */
export async function getDictItems(
	dictSlug: string,
): Promise<DictItemRecord[]> {
	return db
		.select()
		.from(dictItem)
		.where(and(isNull(dictItem.deletedAt), eq(dictItem.dictSlug, dictSlug)))
		.orderBy(asc(dictItem.sortOrder));
}

/** 更新字典类型并返回是否成功 */
export async function updateDictRecord(
	id: string,
	data: Partial<DictRecord>,
): Promise<boolean> {
	const [existing] = await db
		.select()
		.from(dict)
		.where(eq(dict.id, id))
		.limit(1);
	if (!existing) return false;

	if (
		data.slug &&
		data.slug !== existing.slug &&
		PRESET_DICTS.some((d) => d.slug === existing.slug)
	) {
		throw new Error("预置字典的标识(slug)不允许修改");
	}

	const [updated] = await db
		.update(dict)
		.set({ ...data, updatedAt: new Date() })
		.where(eq(dict.id, id))
		.returning();
	if (updated) {
		await loadDictCache();
	}
	return !!updated;
}

/** 创建字典条目 */
export async function createDictItemData(data: {
	dictSlug: string;
	label: string;
	value: string;
	sortOrder?: number;
	extraType?: string | null;
	extra?: string | null;
	color?: string | null;
}): Promise<DictItemRecord> {
	const [result] = await db.insert(dictItem).values(data).returning();
	await loadDictCache();
	return result;
}

/** 更新字典条目并返回是否成功 */
export async function updateDictItemRecord(
	id: string,
	data: Partial<DictItemRecord>,
): Promise<boolean> {
	if (data.value) {
		const [item] = await db
			.select()
			.from(dictItem)
			.where(eq(dictItem.id, id))
			.limit(1);
		if (item && PRESET_DICTS.some((d) => d.slug === item.dictSlug)) {
			throw new Error("预置字典条目的值(value)不允许修改");
		}
	}
	const [updated] = await db
		.update(dictItem)
		.set({ ...data, updatedAt: new Date() })
		.where(eq(dictItem.id, id))
		.returning();
	if (updated) {
		await loadDictCache();
	}
	return !!updated;
}

/** 软删除字典条目并返回是否成功 */
export async function deleteDictItemRecord(id: string): Promise<boolean> {
	const [existing] = await db
		.select()
		.from(dictItem)
		.where(eq(dictItem.id, id))
		.limit(1);
	if (!existing) return false;

	if (PRESET_DICTS.some((d) => d.slug === existing.dictSlug)) {
		throw new Error("预置字典条目不允许删除");
	}

	await db
		.update(dictItem)
		.set({ deletedAt: new Date() })
		.where(eq(dictItem.id, id));
	await loadDictCache();
	return true;
}

// ========== 导入导出 ==========

/** 导出全部字典数据 */
export async function exportAllDicts(): Promise<{
	dicts: {
		name: string;
		slug: string;
		description: string | null;
		children: DictItemRecord[];
	}[];
}> {
	const [dictRecords, dictItems] = await Promise.all([
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
	const tree = dictRecords.map((d) => ({
		name: d.name,
		slug: d.slug,
		description: d.description,
		children: dictItems.filter((i) => i.dictSlug === d.slug),
	}));
	return { dicts: tree };
}

/** 导入字典数据（事务中 upsert） */
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

	await withTransaction(async (tx) => {
		const importedSlugs = new Set(data.dicts.map((d) => d.slug));
		const existingDicts = await tx
			.select({ slug: dict.slug })
			.from(dict)
			.where(isNull(dict.deletedAt));
		for (const d of existingDicts) importedSlugs.add(d.slug);

		for (const d of data.dicts) {
			const [existing] = await tx
				.select()
				.from(dict)
				.where(and(eq(dict.slug, d.slug), isNull(dict.deletedAt)))
				.limit(1);
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
			const [existing] = await tx
				.select()
				.from(dictItem)
				.where(
					and(
						eq(dictItem.dictSlug, item.dictSlug),
						eq(dictItem.value, item.value),
						isNull(dictItem.deletedAt),
					),
				)
				.limit(1);
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

	await loadDictCache();
	return result;
}
