/**
 * 系统配置 Server Function 包装器：客户端可见配置 + 导出 / 导入
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toJson } from "#/lib/export/export.utils";
import { DEFAULT_LOCALE, type Locale } from "#/lib/i18n/i18n.types";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import {
	type ConfigImportResult,
	getConfigList as getConfigListService,
	getConfigTranslations,
	getVisibleConfigRows,
	importConfigs,
} from "#/server/config/config.server";
import { logOperation } from "#/server/operation-log/operation-log.server";

/** 获取客户端可见的系统配置（按当前 locale 解析值，无权限守卫） */
export const getVisibleConfigsSFn = createServerFn({ method: "GET" }).handler(
	async ({ context }) => {
		const locale: Locale = (context.locale as Locale) || DEFAULT_LOCALE;
		const rows = await getVisibleConfigRows();
		const translations = await getConfigTranslations(locale);
		const config: Record<string, string> = {};
		for (const c of rows) config[c.key] = translations[c.id] ?? c.value;
		return config;
	},
);

// ─── 导出 / 导入 ───

const configItemSchema = z.object({
	key: z.string().min(1),
	value: z.string().min(1),
	clientVisible: z.boolean().optional(),
	valueType: z.string().optional(),
	groupName: z.string().nullable().optional(),
	description: z.string().nullable().optional(),
});

const configImportSchema = z.object({
	configs: z.array(configItemSchema),
});

/** 导出系统配置数据（JSON） */
export const exportConfigsSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.CONFIG_EXPORT)])
	.handler(async () => {
		const configs = await getConfigListService();
		return toJson({ configs });
	});

/** 导入系统配置数据（JSON） */
export const importConfigsSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.CONFIG_IMPORT)])
	.inputValidator(z.object({ data: configImportSchema }))
	.handler(async ({ data: { data }, context }): Promise<ConfigImportResult> => {
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
