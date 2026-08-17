/**
 * 定时任务调度器：基于 cron 库的轻量级定时任务管理
 * 日志实例经 setSchedulerLogger 注入，模块自身不依赖全局日志单例
 */
import { CronJob, CronTime } from "cron";
import { DEFAULT_TASK_TIME_ZONE } from "../utils/date-format";
import type { Logger } from "./logger";

/** 任务定义 */
export interface ScheduledTask {
	/** 任务名称 */
	name: string;
	/** cron 表达式（标准 5 或 6 字段） */
	cronExpression: string;
	/** 任务执行函数 */
	handler: () => Promise<void>;
	/** 是否立即执行一次 */
	runOnInit?: boolean;
	/** 任务执行时区，默认 Asia/Shanghai（业务统一时区） */
	timeZone?: string;
}

/** 已注册的任务映射 */
const tasks = new Map<string, CronJob>();

let _logger: Logger | null = null;

/** 注入日志实例（bootstrap 启动时调用） */
export function setSchedulerLogger(logger: Logger): void {
	_logger = logger;
}

/** 测试专用：重置注入状态 */
export function resetSchedulerLoggerForTest(): void {
	_logger = null;
}

/** 获取日志实例，未注入时抛错（fail-fast） */
function getLogger(): Logger {
	if (!_logger) {
		throw new Error("定时任务模块未初始化，请先调用 setSchedulerLogger()");
	}
	return _logger;
}

/**
 * 注册并启动定时任务
 */
export function registerTask(task: ScheduledTask): void {
	const logger = getLogger();
	const validation = CronTime.validateCronExpression(task.cronExpression);
	if (!validation.valid) {
		logger.warn(
			{
				name: task.name,
				expr: task.cronExpression,
				error: validation.error?.message,
			},
			"无效的 cron 表达式",
		);
		return;
	}

	if (tasks.has(task.name)) {
		logger.warn({ name: task.name }, "定时任务已存在，跳过注册");
		return;
	}

	const job = CronJob.from({
		cronTime: task.cronExpression,
		timeZone: task.timeZone ?? DEFAULT_TASK_TIME_ZONE,
		onTick: () => {
			logger.info({ name: task.name }, "定时任务开始执行");
			task
				.handler()
				.then(() => {
					logger.info({ name: task.name }, "定时任务执行完成");
				})
				.catch((err) => {
					logger.error({ name: task.name, err }, "定时任务执行失败");
				});
		},
		start: true,
		runOnInit: task.runOnInit ?? false,
		name: task.name,
	});

	tasks.set(task.name, job);

	if (task.runOnInit) {
		logger.info({ name: task.name }, "定时任务注册完成，立即执行一次");
	} else {
		logger.info(
			{ name: task.name, cron: task.cronExpression },
			"定时任务注册完成",
		);
	}
}

/**
 * 停止指定任务
 */
export function stopTask(name: string): void {
	const logger = getLogger();
	const job = tasks.get(name);
	if (job) {
		// cron v4 stop() 可能返回 Promise，忽略异步
		const result = job.stop();
		if (result && typeof result.then === "function") {
			result.catch((err) => {
				logger.warn(
					{ name, error: (err as Error).message },
					"定时任务停止失败",
				);
			});
		}
		tasks.delete(name);
		logger.info({ name }, "定时任务已停止");
	}
}

/**
 * 停止所有任务
 */
export function stopAllTasks(): void {
	const logger = getLogger();
	for (const [name, job] of tasks) {
		const result = job.stop();
		if (result && typeof result.then === "function") {
			result.catch((err) => {
				logger.warn(
					{ name, error: (err as Error).message },
					"定时任务停止失败",
				);
			});
		}
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
