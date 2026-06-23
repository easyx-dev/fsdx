/**
 * 服务启动初始化：环境变量加载、错误处理、预置数据、定时任务、优雅关闭
 */
import { resolve } from "node:path";
import { config } from "dotenv";
import { logger } from "#/lib/logger/logger";
import { ensurePresetConfigs } from "#/server/config/config.server";
import { ensurePresetDicts } from "#/server/dict/dict.server";
import {
	ensurePresetEvents,
	ensurePresetProperties,
	flushTrackEvents,
	loadPresetCache,
} from "#/server/event/event.server";
import { ensurePresetTranslations } from "#/server/i18n/i18n-seed";
import { flushOperationLogs } from "#/server/operation-log/operation-log.server";
import { registerAllTasks } from "#/server/tasks/tasks.server";

export function bootstrap() {
	logger.info("服务启动初始化开始");

	// 加载环境变量（优先级：.env.local > .env）
	config({ path: resolve(process.cwd(), "env", ".env") });
	config({ path: resolve(process.cwd(), "env", ".env.local"), override: true });

	// 独立预置数据（fire-and-forget，不阻塞服务启动，无交叉依赖）
	void ensurePresetDicts().catch((err) => {
		logger.error({ err }, "预置字典初始化失败");
	});
	void ensurePresetConfigs().catch((err) => {
		logger.error({ err }, "预置系统配置初始化失败");
	});
	void ensurePresetTranslations().catch((err) => {
		logger.error({ err }, "预置翻译初始化失败");
	});

	// 事件预设 → 缓存加载有依赖链：先写 presetEvent/presetProperty，再加载缓存
	void Promise.all([ensurePresetEvents(), ensurePresetProperties()])
		.then(() => loadPresetCache())
		.catch((err) => {
			logger.error({ err }, "预设事件/属性或缓存加载失败");
		});

	// 注册定时任务
	registerAllTasks();

	// 注册进程级异常处理器
	process.on("uncaughtException", (err, origin) => {
		logger.fatal({ err, origin }, "未捕获的异常，进程即将退出");
		process.exit(1);
	});
	process.on("unhandledRejection", (reason) => {
		logger.fatal({ err: reason }, "未处理的 Promise 拒绝");
	});

	// 注册优雅关闭处理器
	let shuttingDown = false;
	const gracefulShutdown = async () => {
		if (shuttingDown) return;
		shuttingDown = true;
		logger.info("收到退出信号，开始优雅关闭...");
		await Promise.all([flushTrackEvents(), flushOperationLogs()]);
	};
	process.on("SIGTERM", () => {
		gracefulShutdown().finally(() => process.exit(0));
	});
	process.on("SIGINT", () => {
		gracefulShutdown().finally(() => process.exit(0));
	});

}
