/**
 * 定时任务注册：在服务启动时调用
 */

import { logger } from "#/lib/logger/logger";
import { registerTask } from "#/lib/scheduler/scheduler";
import { cleanExpiredFiles } from "#/server/file/file.server";

/** 注册所有定时任务 */
export function registerAllTasks(): void {
	// 每小时清理过期临时文件
	registerTask({
		name: "清理过期临时文件",
		cronExpression: "0 * * * *",
		handler: async () => {
			const count = await cleanExpiredFiles();
			if (count > 0) {
				logger.info({ count }, "已清理过期临时文件");
			}
		},
	});

	// 每天凌晨 3 点清理 N 天前的日志文件（后续阶段实现）
	registerTask({
		name: "清理过期日志文件",
		cronExpression: "0 3 * * *",
		handler: async () => {
			// 阶段 6 实现
		},
	});
}
