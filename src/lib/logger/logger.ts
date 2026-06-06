/**
 * 日志模块：基于 pino + pino-roll，按天自动切割日志文件
 * 注意：直接读取 process.env，避免模块级导入与 pino transport worker 冲突
 */
import pino from "pino";

/** 获取当前日期的日志文件名 */
function getLogDate(): string {
	const d = new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

const logLevel = process.env.LOG_LEVEL || "info";
const isProd = process.env.NODE_ENV === "production";
const storageDir = process.env.STORAGE_DIR || ".tmp";

/** 创建 pino 日志实例，同时输出到 stdout（开发）和按天切割的文件 */
export const logger = pino({
	level: logLevel,
	transport: {
		targets: [
			{
				target: "pino-roll",
				options: {
					file: `${storageDir}/logs/${getLogDate()}`,
					frequency: "daily",
					mkdir: true,
					extension: ".log",
				},
				level: "info",
			},
			{
				target: "pino/file",
				options: { destination: 1 },
				level: isProd ? "warn" : "info",
			},
		],
	},
});
