/**
 * 环境变量统一管理：zod 校验 + 默认值
 * SMTP 相关配置已迁移至系统配置，不再通过环境变量管理
 */

import { resolve } from "node:path";
import { config } from "dotenv";
import { z } from "zod";

// 从 env/ 目录加载环境变量（优先级：.env.local > .env）
config({ path: resolve(process.cwd(), "env", ".env") });
config({ path: resolve(process.cwd(), "env", ".env.local"), override: true });

export const envSchema = z.object({
	DATABASE_URL: z.string().min(1, "DATABASE_URL 不能为空"),
	JWT_SECRET: z
		.string()
		.min(32, "JWT_SECRET 至少需要 32 个字符")
		.default("cms-dev-secret-change-in-production"),
	LOG_LEVEL: z
		.enum(["fatal", "error", "warn", "info", "debug", "trace"])
		.default("info"),
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	STORAGE_DIR: z.string().default(".tmp"),
});

/** 环境变量类型 */
export type Env = {
	/** PostgreSQL 连接 URL */
	DATABASE_URL: string;
	/** JWT access token 密钥（至少 32 字符） */
	JWT_SECRET: string;
	/** Pino 日志级别 */
	LOG_LEVEL: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
	/** 运行环境 */
	NODE_ENV: "development" | "production" | "test";
	/** 数据存储目录（日志、上传文件等） */
	STORAGE_DIR: string;
};

let _env: Env | null = null;

/**
 * 获取环境变量（懒加载单例，首次调用时校验）
 */
export function getEnv(): Env {
	if (_env) return _env;

	const parsed = envSchema.safeParse(process.env);

	if (!parsed.success) {
		console.error("环境变量校验失败:", parsed.error.flatten());
		throw new Error(`环境变量校验失败: ${parsed.error.message}`);
	}

	_env = {
		DATABASE_URL: parsed.data.DATABASE_URL,
		JWT_SECRET: parsed.data.JWT_SECRET,
		LOG_LEVEL: parsed.data.LOG_LEVEL,
		NODE_ENV: parsed.data.NODE_ENV,
		STORAGE_DIR: parsed.data.STORAGE_DIR,
	};

	return _env;
}
