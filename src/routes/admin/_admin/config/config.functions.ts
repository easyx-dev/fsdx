/**
 * 系统配置管理路由共享 Server Function
 */

import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "#/db/index";
import { systemConfig } from "#/db/schema";
import { toJson } from "#/lib/export/export.utils";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import {
	createConfig,
	deleteConfig,
	getConfigList,
	loadConfigCache,
	updateConfig,
} from "#/server/config/config.server";
import { logOperation } from "#/server/operation-log/operation-log.server";
import {
	configImportSchema,
	createConfigSchema,
	deleteConfigSchema,
	updateConfigSchema,
} from "./config.schemas";

/** 获取配置列表 */
export const getConfigListSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.CONFIG_VIEW)])
	.handler(async () => {
		return getConfigList();
	});

/** 创建配置 */
export const createConfigSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.CONFIG_CREATE)])
	.inputValidator(createConfigSchema)
	.handler(async ({ data, context }) => {
		const result = await createConfig(data);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "config",
			action: "create",
			targetType: "config",
			targetId: result.id,
			targetName: result.key,
		});
		return { success: true };
	});

/** 更新配置 */
export const updateConfigSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.CONFIG_EDIT)])
	.inputValidator(updateConfigSchema)
	.handler(async ({ data, context }) => {
		const { id, ...rest } = data;
		await updateConfig(id, rest);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "config",
			action: "update",
			targetType: "config",
			targetId: data.id,
		});
		return { success: true };
	});

/** 删除配置 */
export const deleteConfigSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.CONFIG_DELETE)])
	.inputValidator(deleteConfigSchema)
	.handler(async ({ data, context }) => {
		await deleteConfig(data.id);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "config",
			action: "delete",
			targetType: "config",
			targetId: data.id,
		});
		return { success: true };
	});

/** 导出配置数据（JSON） */
export const exportConfigsSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.CONFIG_EXPORT)])
	.handler(async () => {
		const configs = await getConfigList();
		return toJson({ configs });
	});

/** 配置导入数据格式 */
export interface ConfigImportData {
	configs: {
		key: string;
		value: string;
		clientVisible?: boolean;
		valueType?: string;
		groupName?: string | null;
		description?: string | null;
	}[];
}

export interface ConfigImportResult {
	created: number;
	updated: number;
}

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

/** 导入配置数据（JSON） */
export const importConfigsSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.CONFIG_IMPORT)])
	.inputValidator(configImportSchema)
	.handler(async ({ data, context }) => {
		const result = await importConfigs(data);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "config",
			action: "import",
			targetType: "config",
			detail: {
				created: result.created,
				updated: result.updated,
			},
		});
		return result;
	});
