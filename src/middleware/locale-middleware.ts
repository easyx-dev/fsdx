/**
 * 语言检测中间件：在每次请求时从 Cookie / ?lang= 解析 locale，
 * 注入 context.locale 供下游 beforeLoad 使用
 */
import { createMiddleware } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import {
	DEFAULT_LOCALE,
	LOCALE_COOKIE,
	type Locale,
} from "#/lib/i18n/i18n.types";

/**
 * 全局语言中间件：解析 locale 并注入 context
 * 注册在 start.ts requestMiddleware 中，在每个请求的最早阶段执行
 */
export const localeMiddleware = createMiddleware().server(async ({ next }) => {
	const cookieLocale = getCookie(LOCALE_COOKIE) as Locale;
	return next({ context: { locale: cookieLocale || DEFAULT_LOCALE } });
});
