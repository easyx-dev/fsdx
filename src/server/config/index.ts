/**
 * 系统配置管理：CRUD 操作 + 内存缓存
 */
import { asc, eq, isNull } from "drizzle-orm";
import { db } from "#/db/index";
import { systemConfig } from "#/db/schema";
import { configCache } from "#/lib/cache";
import { logger } from "#/lib/logger";

export type ConfigRecord = typeof systemConfig.$inferSelect;

export async function loadConfigCache(): Promise<void> {
	const configs = await db
		.select()
		.from(systemConfig)
		.where(isNull(systemConfig.deletedAt));
	configCache.clear();
	for (const c of configs) configCache.set(c.key, c.value);
	logger.info({ count: configs.length }, "系统配置缓存加载完成");
}

export function getConfig(key: string): string {
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

/**
 * 插入或更新系统配置（key 冲突时更新 value）
 * 用于初始化流程，避免因 ensurePresetConfigs 已插入默认值导致冲突
 */
export async function upsertConfig(
	key: string,
	value: string,
	description?: string,
): Promise<void> {
	const existing = await db.query.systemConfig.findFirst({
		where: eq(systemConfig.key, key),
	});

	if (existing) {
		await db
			.update(systemConfig)
			.set({
				value,
				description: description ?? existing.description,
				updatedAt: new Date(),
			})
			.where(eq(systemConfig.id, existing.id));
	} else {
		await db.insert(systemConfig).values({ key, value, description });
	}

	configCache.set(key, value);
	logger.info({ key }, "系统配置已写入");
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

// ========== 预置系统配置 ==========

/** 预置系统配置常量（仅服务端启动时自动插入的配置项） */
const PRESET_CONFIGS = [
	{ key: "site_name", value: "FSDX CMS", description: "站点名称" },
];

/** 运行时校验并插入缺失的预置系统配置（幂等安全） */
export async function ensurePresetConfigs(): Promise<void> {
	for (const preset of PRESET_CONFIGS) {
		const existing = await db.query.systemConfig.findFirst({
			where: eq(systemConfig.key, preset.key),
		});
		if (!existing) {
			await db.insert(systemConfig).values(preset);
			logger.info({ key: preset.key }, "预置系统配置已创建");
		}
	}
}
