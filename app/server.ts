/**
 * Nitro server entry：项目根目录的 server.ts 被 Nitro 自动检测
 * bootstrap 先于一切请求执行；fetch 仅做统一埋点，随后交还请求流转至 TanStack Start SSR
 * 注意：禁止直接 import src/server.ts（会绕过 Vite SSR runner 惰性路由，导致路由 eager 加载）
 */
import { bootstrap } from "./src/bootstrap";
import { httpRequestsTotal } from "./src/lib/metrics/metrics";

await bootstrap();

export default {
	async fetch(req: Request) {
		httpRequestsTotal.inc({ method: req.method });
		// 返回 undefined → 请求继续流转至 TanStack Start SSR / 静态资源等
		return undefined;
	},
};
