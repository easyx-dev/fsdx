/**
 * 日志单例壳：createLogger 工厂来自 @fsdx/core/logger
 * 各模块统一从本模块导入 logger 实例，参数显式从环境变量传入
 */
import { createLogger } from "@fsdx/core/logger";

export {
	createLogger,
	type Logger,
	type LoggerOptions,
} from "@fsdx/core/logger";

/** 应用级默认日志实例：配置从环境变量读取 */
export const logger = createLogger({
	level: process.env.LOG_LEVEL || "info",
	storageDir: process.env.STORAGE_DIR || ".tmp",
	isProd: process.env.NODE_ENV === "production",
});
