/**
 * 系统配置管理：CRUD 操作 + 内存缓存
 */
import { asc, eq, isNull } from "drizzle-orm";
import { db } from "#/db/index";
import { systemConfig } from "#/db/schema";
import { configCache } from "#/lib/cache";
import { logger } from "#/lib/logger";

export type ConfigRecord = typeof systemConfig.$inferSelect;

let cacheLoaded = false;

async function ensureCache(): Promise<void> {
	if (!cacheLoaded) {
		await loadConfigCache();
		cacheLoaded = true;
	}
}

export async function loadConfigCache(): Promise<void> {
	const configs = await db
		.select()
		.from(systemConfig)
		.where(isNull(systemConfig.deletedAt));
	configCache.clear();
	for (const c of configs) configCache.set(c.key, c.value);
	cacheLoaded = true;
	logger.info({ count: configs.length }, "系统配置缓存加载完成");
}

export async function getConfig(key: string): Promise<string> {
	await ensureCache();
	return configCache.get(key) ?? "";
}

export async function getConfigList() {
	return db
		.select()
		.from(systemConfig)
		.where(isNull(systemConfig.deletedAt))
		.orderBy(asc(systemConfig.key));
}

export async function createConfig(params: {
	key: string;
	value: string;
	description?: string;
}) {
	const [record] = await db.insert(systemConfig).values(params).returning();
	configCache.set(record.key, record.value);
	logger.info({ key: record.key }, "系统配置已创建");
	return record;
}

export async function updateConfig(
	id: string,
	params: { value?: string; description?: string },
) {
	const [updated] = await db
		.update(systemConfig)
		.set({ ...params, updatedAt: new Date() })
		.where(eq(systemConfig.id, id))
		.returning();
	if (updated) {
		configCache.set(updated.key, updated.value);
		logger.info({ key: updated.key }, "系统配置已更新");
	}
	return updated ?? null;
}

export async function deleteConfig(id: string) {
	const existing = await db.query.systemConfig.findFirst({
		where: eq(systemConfig.id, id),
	});
	if (!existing) return false;
	await db
		.update(systemConfig)
		.set({ deletedAt: new Date() })
		.where(eq(systemConfig.id, id));
	configCache.delete(existing.key);
	logger.info({ key: existing.key }, "系统配置已删除");
	return true;
}
