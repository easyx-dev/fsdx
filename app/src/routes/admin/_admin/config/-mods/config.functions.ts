/**
 * 系统配置管理路由共享 Server Function
 */

import { toJson } from "@fsdx/core/export";
import { createServerFn } from "@tanstack/react-start";
import { adminPermGuard } from "#/middleware/admin-auth";
import { PERMISSIONS } from "#/permissions/permissions";
import {
	createConfig,
	deleteConfig,
	getConfigList,
	updateConfig,
} from "#/services/config/config.server";
import { logCrud } from "#/services/operation-log/operation-log.server";
import {
	configImportSchema,
	createConfigSchema,
	deleteConfigSchema,
	updateConfigSchema,
} from "./config.schemas";
import { importConfigs } from "./config.server";

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
		logCrud(context.user, "config", "create", {
			id: result.id,
			name: result.key,
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
		logCrud(context.user, "config", "update", { id: data.id });
		return { success: true };
	});

/** 删除配置 */
export const deleteConfigSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.CONFIG_DELETE)])
	.inputValidator(deleteConfigSchema)
	.handler(async ({ data, context }) => {
		await deleteConfig(data.id);
		logCrud(context.user, "config", "delete", { id: data.id });
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

/** 导入配置数据（JSON） */
export const importConfigsSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.CONFIG_IMPORT)])
	.inputValidator(configImportSchema)
	.handler(async ({ data, context }) => {
		const result = await importConfigs(data);
		logCrud(context.user, "config", "import", undefined, {
			detail: {
				created: result.created,
				updated: result.updated,
			},
		});
		return result;
	});
