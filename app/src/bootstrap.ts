/**
 * 服务启动初始化：环境变量加载、错误处理、预置数据、定时任务、优雅关闭
 */

import { initAi } from "@fsdx/core/ai";
import { initMail } from "@fsdx/core/mail";
import { setSchedulerLogger } from "@fsdx/core/scheduler";
import { initSms } from "@fsdx/core/sms";
import { runMigrations } from "#/db/migrate";
import { logger } from "#/lib/logger/logger";
import {
	ensurePresetConfigs,
	getConfig,
} from "#/services/config/config.server";
import { ensurePresetDicts } from "#/services/dict/dict.server";
import { ensurePresetTranslations } from "#/services/i18n/i18n-seed";
import { flushOperationLogs } from "#/services/operation-log/operation-log.server";
import { registerAllTasks } from "#/services/tasks/tasks.server";
import {
	ensurePresetEvents,
	ensurePresetProperties,
	flushTrackEvents,
	loadTrackMetaCache,
} from "#/services/track/track.server";

/** 优雅关闭超时时间（毫秒），防止缓冲刷入挂起导致进程无法退出 */
const GRACEFUL_SHUTDOWN_TIMEOUT = 10_000;

export async function bootstrap() {
	// 模块依赖注入：先注入日志依赖各模块（ai/mail/sms/scheduler），服务起来前完成
	initAi({ getConfig, logger });
	initMail({ getConfig, logger });
	initSms({ getConfig, logger });
	setSchedulerLogger(logger);

	logger.info("服务启动初始化开始");
	// 程序化数据库迁移（fail-fast：迁移失败即应用启动失败，避免 schema 不一致静默运行，
	// 生产部署由 deploy.sh 通过健康检查捕获迁移结果）
	await runMigrations();

	// 预置数据：确保缓存就绪后再处理请求
	try {
		await Promise.all([ensurePresetDicts(), ensurePresetConfigs()]);
	} catch (err) {
		logger.error({ err }, "预置字典或系统配置初始化失败");
	}
	void ensurePresetTranslations().catch((err) => {
		logger.error({ err }, "预置翻译初始化失败");
	});

	// 事件预设 → 缓存加载有依赖链：先写 trackEventMeta/trackPropertyMeta，再加载缓存
	void Promise.all([ensurePresetEvents(), ensurePresetProperties()])
		.then(() => loadTrackMetaCache())
		.catch((err) => {
			logger.error({ err }, "预置元事件/元属性或缓存加载失败");
		});

	// 注册定时任务
	registerAllTasks();

	// 注册进程级异常处理器
	process.on("uncaughtException", (err, origin) => {
		logger.fatal({ err, origin }, "未捕获的异常，进程即将退出");
		process.exit(1);
	});
	process.on("unhandledRejection", (reason) => {
		logger.fatal({ err: reason }, "未处理的 Promise 拒绝，进程即将退出");
		process.exit(1);
	});

	// 注册优雅关闭处理器（含超时保护）
	let shuttingDown = false;
	const gracefulShutdown = async () => {
		if (shuttingDown) return;
		shuttingDown = true;
		logger.info("收到退出信号，开始优雅关闭...");
		try {
			await Promise.race([
				Promise.all([flushTrackEvents(), flushOperationLogs()]),
				new Promise<void>((_, reject) =>
					setTimeout(
						() => reject(new Error("缓冲刷入超时，强制退出")),
						GRACEFUL_SHUTDOWN_TIMEOUT,
					),
				),
			]);
			process.exit(0);
		} catch (err) {
			logger.error({ err }, "缓冲刷入失败");
			process.exit(1);
		}
	};

	process.on("SIGTERM", gracefulShutdown);
	process.on("SIGINT", gracefulShutdown);
	process.on("SIGQUIT", gracefulShutdown);
}
