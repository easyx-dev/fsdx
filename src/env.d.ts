/// <reference types="vite/client" />

declare global {
	namespace NodeJS {
		interface ProcessEnv {
			/** PostgreSQL 连接 URL */
			DATABASE_URL: string;
			/** JWT access token 密钥（至少 32 字符） */
			JWT_SECRET: string;
			/** 日志级别 */
			LOG_LEVEL?: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
			/** 运行环境 */
			NODE_ENV?: "development" | "production" | "test";
			/** 数据存储目录（日志、上传文件等） */
			STORAGE_DIR?: string;
		}
	}
}

export {};
