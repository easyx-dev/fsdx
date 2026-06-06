/**
 * getEnv() mock 辅助
 * 用于 lib/server 模块测试中隔离环境变量依赖
 */

import type { Env } from "#/lib/env";

/** 测试环境默认配置 */
export const testEnv: Env = {
	DATABASE_URL: "postgres://test:test@localhost:5432/testdb",
	JWT_SECRET: "test-jwt-secret-at-least-32-characters-long!!",
	LOG_LEVEL: "info",
	NODE_ENV: "test",
	STORAGE_DIR: ".tmp",
};
