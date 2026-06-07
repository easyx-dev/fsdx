/**
 * 日志模块：基于 pino，按天写入日志文件
 * 不使用 pino transport（pino-roll），避免 ESM 打包后 __dirname 未定义问题
 */
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
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

const logDir = join(storageDir, "logs");
if (!existsSync(logDir)) {
	mkdirSync(logDir, { recursive: true });
}

const logFile = join(logDir, `${getLogDate()}.log`);
const fileStream = createWriteStream(logFile, { flags: "a" });

/** 创建 pino 日志实例，同时输出到文件和控制台 */
export const logger = pino(
	{
		level: logLevel,
	},
	pino.multistream([
		{ stream: fileStream, level: "info" },
		{
			stream: process.stdout,
			level: isProd ? "warn" : "info",
		},
	]),
);
