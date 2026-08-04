/**
 * 系统配置管理路由服务层
 */
import { eq } from "drizzle-orm";
import { db } from "#/db/index";
import { systemConfig } from "#/db/schema";
import { loadConfigCache } from "#/services/config/config.server";
import type { ConfigImportData, ConfigImportResult } from "./config.functions";

/** 导入配置数据（按 key upsert） */
export async function importConfigs(
	data: ConfigImportData,
): Promise<ConfigImportResult> {
	const result: ConfigImportResult = { created: 0, updated: 0 };

	for (const cfg of data.configs) {
		const existing = await db.query.systemConfig.findFirst({
			where: eq(systemConfig.key, cfg.key),
		});

		if (existing) {
			await db
				.update(systemConfig)
				.set({
					value: cfg.value,
					clientVisible: cfg.clientVisible ?? existing.clientVisible,
					valueType: cfg.valueType ?? existing.valueType,
					groupName: cfg.groupName ?? existing.groupName,
					description: cfg.description ?? existing.description,
					updatedAt: new Date(),
				})
				.where(eq(systemConfig.id, existing.id));
			result.updated++;
		} else {
			await db.insert(systemConfig).values({
				key: cfg.key,
				value: cfg.value,
				clientVisible: cfg.clientVisible ?? false,
				valueType: cfg.valueType ?? "input",
				groupName: cfg.groupName ?? null,
				description: cfg.description ?? null,
			});
			result.created++;
		}
	}

	await loadConfigCache();
	return result;
}
