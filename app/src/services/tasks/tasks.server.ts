/**
 * 定时任务注册：在服务启动时调用
 */

import { cleanExpiredFiles } from "#/services/file/file.server";
import { cleanExpiredLogs } from "#/services/logs/logs-cleanup.server";
import {
	cleanupSystemMetrics,
	sampleSystemMetric,
} from "#/services/system-metric/system-metric.server";
import { logger } from "#/shared-services/logger";
import { registerTask } from "#/shared-services/scheduler";

/** 系统监控采样保留天数 */
const SYSTEM_METRIC_RETENTION_DAYS = 7;

export function registerAllTasks(): void {
	// 每分钟采集一次系统运行指标（启动即采一条，保证监控页有初始数据）
	registerTask({
		name: "系统监控指标采样",
		cronExpression: "* * * * *",
		runOnInit: true,
		handler: async () => {
			await sampleSystemMetric();
		},
	});

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

	// 每天凌晨 3 点清理 30 天前的日志文件
	registerTask({
		name: "清理过期日志文件",
		cronExpression: "0 3 * * *",
		handler: async () => {
			const count = await cleanExpiredLogs();
			if (count > 0) {
				logger.info({ count }, "已清理过期日志文件");
			}
		},
	});

	// 每天凌晨 4 点清理超过保留期的系统监控数据
	registerTask({
		name: "清理过期系统监控数据",
		cronExpression: "0 4 * * *",
		handler: async () => {
			const count = cleanupSystemMetrics(SYSTEM_METRIC_RETENTION_DAYS);
			if (count > 0) {
				logger.info({ count }, "已清理过期系统监控数据");
			}
		},
	});
}
