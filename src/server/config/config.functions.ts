/**
 * 系统配置 Server Function 包装器：客户端可见的配置数据
 */
import { createServerFn } from "@tanstack/react-start";
import { DEFAULT_LOCALE, type Locale } from "#/lib/i18n/i18n.types";
import {
	getConfigTranslations,
	getVisibleConfigRows,
} from "#/server/config/config.server";

/** 获取客户端可见的系统配置（按当前 locale 解析值，无权限守卫） */
export const getVisibleConfigsFn = createServerFn({ method: "GET" }).handler(
	async ({ context }) => {
		const locale: Locale = (context.locale as Locale) || DEFAULT_LOCALE;
		const rows = await getVisibleConfigRows();
		const translations = await getConfigTranslations(locale);
		const config: Record<string, string> = {};
		for (const c of rows) config[c.key] = translations[c.id] ?? c.value;
		return config;
	},
);
