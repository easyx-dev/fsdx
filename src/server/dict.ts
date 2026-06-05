/**
 * 字典管理：CRUD 操作 + 内存缓存
 */
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "#/db/index";
import { dict, dictItem } from "#/db/schema";
import { dictCache } from "#/lib/cache";
import { logger } from "#/lib/logger";

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
			.select({ slug: dict.slug, label: dictItem.label, value: dictItem.value })
			.from(dictItem)
			.innerJoin(dict, eq(dictItem.dictId, dict.id))
			.where(isNull(dictItem.deletedAt))
			.orderBy(asc(dictItem.sortOrder)),
	]);
	dictCache.clear();
	for (const d of dicts) dictCache.set(d.slug, {});
	for (const item of items) {
		const map = dictCache.get(item.slug) || {};
		map[item.value] = item.label;
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
	return map?.[value] ?? value;
}

export async function getDictMap(
	slug: string,
): Promise<Record<string, string>> {
	await ensureCache();
	return dictCache.get(slug) ?? {};
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
	params: { name?: string; description?: string },
) {
	const [updated] = await db
		.update(dict)
		.set({ ...params, updatedAt: new Date() })
		.where(eq(dict.id, id))
		.returning();
	return updated ?? null;
}

export async function deleteDict(id: string) {
	const existing = await db.query.dict.findFirst({ where: eq(dict.id, id) });
	if (!existing) return false;
	const now = new Date();
	await db.transaction(async (tx) => {
		await tx
			.update(dictItem)
			.set({ deletedAt: now })
			.where(eq(dictItem.dictId, id));
		await tx.update(dict).set({ deletedAt: now }).where(eq(dict.id, id));
	});
	invalidateCache();
	await loadDictCache();
	logger.info({ slug: existing.slug }, "字典类型已删除");
	return true;
}

export async function getDictItemList(dictId: string) {
	return db
		.select()
		.from(dictItem)
		.where(and(isNull(dictItem.deletedAt), eq(dictItem.dictId, dictId)))
		.orderBy(asc(dictItem.sortOrder));
}

export async function createDictItem(params: {
	dictId: string;
	label: string;
	value: string;
	sortOrder?: number;
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
	},
) {
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
	await db
		.update(dictItem)
		.set({ deletedAt: new Date() })
		.where(eq(dictItem.id, id));
	invalidateCache();
	await loadDictCache();
	return true;
}
