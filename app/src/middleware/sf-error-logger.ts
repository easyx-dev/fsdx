/**
 * Server Function 全局错误日志中间件
 * 注册在 start.ts 的 functionMiddleware 中，自动覆盖所有 SF
 * 鉴权失败记 warn（审计需要），系统异常记 error
 */

import { sanitizeError } from "@fsdx/core/error-utils";
import { createMiddleware } from "@tanstack/react-start";
import { logger } from "#/lib/logger/logger";
import { AdminAuthError } from "#/middleware/admin-auth";
import { ClientAuthError } from "#/middleware/client-auth";

export const sfErrorLogger = createMiddleware({ type: "function" }).server(
	async ({ next }) => {
		const startTime = Date.now();

		try {
			const result = await next();
			const duration = Date.now() - startTime;

			// 开发环境记录成功请求耗时，生产环境静默
			if (process.env.NODE_ENV === "development") {
				logger.debug({ duration: `${duration}ms` }, "SF 执行完成");
			}

			return result;
		} catch (error) {
			const duration = Date.now() - startTime;

			if (error instanceof AdminAuthError || error instanceof ClientAuthError) {
				// 鉴权失败：warn 级别（预期行为，但需审计记录）
				logger.warn(
					{
						duration: `${duration}ms`,
						statusCode: error.statusCode,
						message: error.message,
					},
					"鉴权失败",
				);
			} else {
				// 系统错误：error 级别，脱敏后记录
				logger.error(
					{
						duration: `${duration}ms`,
						...sanitizeError(error),
					},
					"Server Function 执行异常",
				);
			}

			throw error; // 保持原有错误传播行为，让框架 error boundary 和客户端 catch 继续处理
		}
	},
);
