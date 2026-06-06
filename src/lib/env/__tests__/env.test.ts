/**
 * 环境变量模块测试：zod schema 校验规则 + getEnv() 基本行为
 */

import { describe, expect, it } from "vitest";
import { envSchema, getEnv } from "#/lib/env";

describe("envSchema 校验规则", () => {
	it("完整有效配置校验通过", () => {
		const result = envSchema.safeParse({
			DATABASE_URL: "postgres://localhost/test",
			JWT_SECRET: "a".repeat(32),
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.DATABASE_URL).toBe("postgres://localhost/test");
			expect(result.data.NODE_ENV).toBe("development"); // 默认值
			expect(result.data.STORAGE_DIR).toBe(".tmp"); // 默认值
		}
	});

	it("缺少 DATABASE_URL 时校验失败", () => {
		const result = envSchema.safeParse({
			JWT_SECRET: "a".repeat(32),
		});
		expect(result.success).toBe(false);
	});

	it("JWT_SECRET 不足 32 字符时校验失败", () => {
		const result = envSchema.safeParse({
			DATABASE_URL: "postgres://localhost/test",
			JWT_SECRET: "short",
		});
		expect(result.success).toBe(false);
	});

	it("NODE_ENV 非法值校验失败", () => {
		const result = envSchema.safeParse({
			DATABASE_URL: "postgres://localhost/test",
			JWT_SECRET: "a".repeat(32),
			NODE_ENV: "invalid-env",
		});
		expect(result.success).toBe(false);
	});

	it("SMTP 字段已移除，不再存在于 envSchema 中", () => {
		const result = envSchema.safeParse({
			DATABASE_URL: "postgres://localhost/test",
			JWT_SECRET: "a".repeat(32),
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).not.toHaveProperty("SMTP_HOST");
		}
	});
});

describe("getEnv", () => {
	it("getEnv 返回 Env 类型对象", () => {
		const env = getEnv();
		expect(env).toHaveProperty("DATABASE_URL");
		expect(env).toHaveProperty("JWT_SECRET");
		expect(env).toHaveProperty("LOG_LEVEL");
		expect(env).toHaveProperty("NODE_ENV");
		expect(env).toHaveProperty("STORAGE_DIR");
	});
});
