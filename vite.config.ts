import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const config = defineConfig({
	envDir: "./env",
	resolve: { tsconfigPaths: true },
	plugins: [
		devtools(),
		tailwindcss(),
		tanstackStart({
			router: {
				routeFileIgnorePattern: "__tests__",
			},
			importProtection: {
				client: {
					specifiers: ["bcryptjs", "drizzle-orm"],
				},
			},
		}),
		viteReact(),
		// 注册服务启动前初始化插件，确保预置数据就绪后再开始接收请求
		nitro({
			plugins: ["./src/startup.ts"],
		}),
	],
});

export default config;
