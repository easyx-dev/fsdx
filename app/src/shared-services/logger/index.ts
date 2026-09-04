/**
 * 日志模块（shared-services）：pino 工厂 + 应用级单例
 * createLogger 工厂参数由宿主应用显式传入（不读环境变量，不设默认值）；
 * logger 单例从环境变量读取配置，mixin 自动注入 requestId 实现链路追踪
 * 不使用 pino transport（pino-roll），避免 ESM 打包后 __dirname 未定义问题
 * 开发环境使用 pino-pretty 作为 Transform Stream 美化控制台输出
 */
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { toDateString } from "@fsdx/lib/date-format";
import pino from "pino";
import pinoPretty from "pino-pretty";
import { getRequestId } from "#/shared-services/request-context";

/** 日志实例创建选项 */
export interface LoggerOptions {
	/** 日志级别 */
	level: string;
	/** 存储目录（logs 子目录位于其下），由宿主应用传入 */
	storageDir: string;
	/** 生产环境标志 */
	isProd: boolean;
	/**
	 * 每条日志自动合并的附加字段（如 requestId），由宿主注入以解耦模块与请求上下文
	 * 无附加字段时返回空对象
	 */
	mixin?: () => Record<string, unknown>;
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
	const { level, storageDir, isProd, mixin } = opts;

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
		{ level, mixin },
		pino.multistream([
			{ stream: fileStream, level: "info" },
			{
				stream: stdoutStream,
				level: isProd ? "warn" : "info",
			},
		]),
	);
}

/** 应用级默认日志实例：配置从环境变量读取，mixin 自动注入 requestId 实现链路追踪 */
export const logger = createLogger({
	level: process.env.LOG_LEVEL || "info",
	storageDir: process.env.STORAGE_DIR || ".tmp",
	isProd: process.env.NODE_ENV === "production",
	mixin: () => {
		const requestId = getRequestId();
		return requestId ? { requestId } : {};
	},
});
