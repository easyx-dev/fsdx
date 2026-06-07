/**
 * 字典管理：CRUD 操作 + 内存缓存
 */
import { and, asc, eq, isNull } from "drizzle-orm";
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
			.select({ slug: dict.slug, label: dictItem.label, value: dictItem.value })
			.from(dictItem)
			.innerJoin(dict, eq(dictItem.dictSlug, dict.slug))
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
	params: { name?: string; slug?: string; description?: string },
) {
	const existing = await db.query.dict.findFirst({ where: eq(dict.id, id) });
	if (!existing) return null;

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

// ========== 预置字典 ==========

/** 预置字典常量 */
const PRESET_DICTS = [
	{
		slug: "news_status",
		name: "新闻状态",
		items: [
			{ label: "草稿", value: "draft", sortOrder: 0 },
			{ label: "已发布", value: "published", sortOrder: 1 },
			{ label: "已归档", value: "archived", sortOrder: 2 },
		],
	},
	{
		slug: "user_status",
		name: "用户状态",
		items: [
			{ label: "正常", value: "active", sortOrder: 0 },
			{ label: "禁用", value: "disabled", sortOrder: 1 },
		],
	},
];

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
			});
		}
		logger.info({ slug: preset.slug }, "预置字典已创建");
	}
}
