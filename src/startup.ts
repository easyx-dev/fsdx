import { resolve } from "node:path";
import { config } from "dotenv";
import { definePlugin } from "nitro";
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

export default definePlugin(() => {
	console.log("=======INIT START========");
	// 从 env/ 目录加载环境变量（优先级：.env.local > .env）
	config({ path: resolve(process.cwd(), "env", ".env") });
	config({ path: resolve(process.cwd(), "env", ".env.local"), override: true });

	// 进程级未捕获异常处理器：记录完整日志后退出，避免状态不一致
	process.on("uncaughtException", (err, origin) => {
		logger.fatal({ err, origin }, "未捕获的异常，进程即将退出");
		process.exit(1);
	});

	// 进程级未处理的 Promise 拒绝：记录完整日志
	process.on("unhandledRejection", (reason) => {
		logger.fatal({ err: reason }, "未处理的 Promise 拒绝");
	});

	// 服务进程启动时同步等待，确保预置数据写入完成后才开始接收请求
	ensurePresetDicts();
	ensurePresetConfigs();
	ensurePresetEvents();
	ensurePresetProperties();
	ensurePresetTranslations();
	loadPresetCache().catch(() => {});
	registerAllTasks();

	// 进程退出时刷新缓冲，避免事件和操作日志丢失
	const gracefulShutdown = async () => {
		await Promise.all([flushTrackEvents(), flushOperationLogs()]);
	};
	process.on("SIGTERM", () => {
		gracefulShutdown().finally(() => process.exit(0));
	});
	process.on("SIGINT", () => {
		gracefulShutdown().finally(() => process.exit(0));
	});
});
