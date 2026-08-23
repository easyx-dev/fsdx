/**
 * Hono 应用工厂：创建 Hono 实例并注册自定义路由
 * 生产/开发环境共享同一 app 定义
 */
import { Hono } from "hono";

export function createHonoApp() {
	const app = new Hono();

	// 自定义 API 路由在下方添加

	return app;
}
