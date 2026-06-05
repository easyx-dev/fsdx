/**
 * 服务端入口：进程启动时执行预置数据校验与初始化
 */
import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { logger } from "#/lib/logger";
import { ensurePresetConfigs } from "#/server/config";
import { ensurePresetDicts } from "#/server/dict";
import { registerAllTasks } from "#/server/tasks";

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
try {
	await ensurePresetDicts();
	await ensurePresetConfigs();
	registerAllTasks();
} catch (err) {
	logger.fatal({ err }, "服务初始化失败，进程即将退出");
	process.exit(1);
}

export default createServerEntry({
	fetch(request) {
		return handler.fetch(request);
	},
});
