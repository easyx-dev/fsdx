/**
 * 字典管理：CRUD 操作 + 内存缓存
 */
import { asc, eq, isNull } from "drizzle-orm";
import { PRESET_DICTS } from "#/constants";
import { db } from "#/db/index";
import { dict, dictItem } from "#/db/schema";
import { dictCache } from "#/lib/cache/cache";
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
