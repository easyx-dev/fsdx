/**
 * TanStack Start 入口配置：全局 locale 中间件 + CSRF 中间件
 */
import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import { localeMiddleware } from "#/middleware/locale-middleware";

const csrfMiddleware = createCsrfMiddleware({
	filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
	requestMiddleware: [localeMiddleware, csrfMiddleware],
}));
