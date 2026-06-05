/**
 * 定时任务调度器：基于 node-cron 的轻量级定时任务管理
 */
import cron from "node-cron";
import { logger } from "#/lib/logger";

/** 任务定义 */
export interface ScheduledTask {
	/** 任务名称 */
	name: string;
	/** cron 表达式 */
	cronExpression: string;
	/** 任务执行函数 */
	handler: () => Promise<void>;
	/** 是否立即执行一次 */
	runOnInit?: boolean;
}

/** 已注册的任务映射 */
const tasks = new Map();

/**
 * 注册并启动定时任务
 */
export function registerTask(task: ScheduledTask): void {
	if (!cron.validate(task.cronExpression)) {
		logger.error(
			{ name: task.name, expr: task.cronExpression },
			"无效的 cron 表达式",
		);
		return;
	}

	if (tasks.has(task.name)) {
		logger.warn({ name: task.name }, "定时任务已存在，跳过注册");
		return;
	}

	const cronTask = cron.schedule(
		task.cronExpression,
		async () => {
			logger.info({ name: task.name }, "定时任务开始执行");
			try {
				await task.handler();
				logger.info({ name: task.name }, "定时任务执行完成");
			} catch (err) {
				logger.error({ name: task.name, err }, "定时任务执行失败");
			}
		},
		{ scheduled: true } as any,
	);

	tasks.set(task.name, cronTask);

	if (task.runOnInit) {
		logger.info({ name: task.name }, "定时任务注册完成，立即执行一次");
		task.handler().catch((err) => {
			logger.error({ name: task.name, err }, "定时任务首次执行失败");
		});
	} else {
		logger.info({ name: task.name }, "定时任务注册完成");
	}
}

/**
 * 停止指定任务
 */
export function stopTask(name: string): void {
	const task = tasks.get(name);
	if (task) {
		task.stop();
		tasks.delete(name);
		logger.info({ name }, "定时任务已停止");
	}
}

/**
 * 停止所有任务
 */
export function stopAllTasks(): void {
	for (const [name, task] of tasks) {
		task.stop();
		logger.info({ name }, "定时任务已停止");
	}
	tasks.clear();
}

/**
 * 获取已注册的任务名称列表
 */
export function getTaskNames(): string[] {
	return Array.from(tasks.keys());
}
