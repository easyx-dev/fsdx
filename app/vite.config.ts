import { readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, type PluginOption } from "vite";

/** 应用版本号（来自 app/package.json，构建时注入 __APP_VERSION__） */
const appVersion = (
	JSON.parse(
		readFileSync(new URL("./package.json", import.meta.url), "utf8"),
	) as { version: string }
).version;

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	define: {
		__APP_VERSION__: JSON.stringify(appVersion),
	},
	plugins: [
		devtools(),
		tailwindcss(),
		tanstackStart({
			router: {
				routeFileIgnorePattern: "\\.(functions|server|schemas)\\.ts$|__tests__",
			},
			importProtection: {
				client: {
					specifiers: ["bcryptjs", "drizzle-orm", "openai"],
				},
			},
		}),
		viteReact(),
		// Nitro 仅负责打包，server.ts 由 Nitro 自动检测作为 server entry
		nitro(),
		// 修复：Vite dev server 在 Sec-Fetch-Dest: image 时会将路由当作静态资源拦截，
		// 导致 <img> 标签加载图片返回 404。此插件在 Vite 内部中间件之前移除该请求头
		secFetchDestImageFix(),
	],
});

/** 开发环境修复：移除 Sec-Fetch-Dest: image 避免 Vite 内部中间件拦截 */
function secFetchDestImageFix(): PluginOption {
	return {
		name: "sec-fetch-dest-image-fix",
		configureServer(server) {
			server.middlewares.stack.unshift({
				route: "",
				handle: (
					req: IncomingMessage,
					_res: ServerResponse,
					next: () => void,
				) => {
					if (req.headers["sec-fetch-dest"] === "image") {
						delete req.headers["sec-fetch-dest"];
					}
					next();
				},
			} as never);
		},
	};
}

export default config;
