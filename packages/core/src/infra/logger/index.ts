/**
 * 日志模块：基于 pino，按天写入日志文件
 * createLogger 工厂的参数由宿主应用显式传入（不读环境变量，不设默认值）
 * 不使用 pino transport（pino-roll），避免 ESM 打包后 __dirname 未定义问题
 * 开发环境使用 pino-pretty 作为 Transform Stream 美化控制台输出
 */
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import pino from "pino";
import pinoPretty from "pino-pretty";
import { toDateString } from "../../utils/date-format";

/** 日志实例创建选项 */
export interface LoggerOptions {
	/** 日志级别 */
	level: string;
	/** 存储目录（logs 子目录位于其下），由宿主应用传入 */
	storageDir: string;
	/** 生产环境标志 */
	isProd: boolean;
}

/** pino 日志实例类型 */
export type Logger = pino.Logger;

/** 获取当前日期的日志文件名（按业务统一时区切割） */
function getLogDate(): string {
	return toDateString(new Date());
}

/**
 * 创建 pino 日志实例：文件按天切割 + 控制台输出（开发环境 pino-pretty 美化）
 */
export function createLogger(opts: LoggerOptions): Logger {
	const { level, storageDir, isProd } = opts;

	const logDir = join(storageDir, "logs");
	if (!existsSync(logDir)) {
		mkdirSync(logDir, { recursive: true });
	}

	const logFile = join(logDir, `${getLogDate()}.log`);
	const fileStream = createWriteStream(logFile, { flags: "a" });

	/** 开发环境美化控制台输出 */
	const stdoutStream = isProd
		? process.stdout
		: pinoPretty({
				colorize: true,
				translateTime: "SYS:standard",
				ignore: "pid,hostname",
				destination: process.stdout,
			});

	return pino(
		{ level },
		pino.multistream([
			{ stream: fileStream, level: "info" },
			{
				stream: stdoutStream,
				level: isProd ? "warn" : "info",
			},
		]),
	);
}
