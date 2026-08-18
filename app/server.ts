/**
 * Nitro server entry：项目根目录的 server.ts 被 Nitro 自动检测
 * Hono 处理自定义 API 路由，未匹配的请求透传至 TanStack Start SSR
 *
 * 参考：https://nitro.build/raw/examples/hono.md
 */
import { bootstrap } from "./src/bootstrap";
import { createHonoApp } from "./src/hono-app";
import { httpRequestsTotal } from "./src/lib/metrics/metrics";

await bootstrap();

const app = createHonoApp();

export default {
	async fetch(req: Request) {
		httpRequestsTotal.inc({ method: req.method });
		const res = await app.fetch(req);
		// Hono 未匹配（404）→ 返回 undefined → Nitro 继续到 TanStack Start SSR
		return res.status !== 404 ? res : undefined;
	},
};
