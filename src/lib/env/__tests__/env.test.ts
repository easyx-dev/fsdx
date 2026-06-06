/**
 * 环境变量模块测试：zod schema 校验规则 + getEnv() 基本行为
 */

import { describe, expect, it } from "vitest";
import { envSchema, getEnv, smtpSchema } from "#/lib/env";

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

	it("SMTP 字段全部可选", () => {
		const result = envSchema.safeParse({
			DATABASE_URL: "postgres://localhost/test",
			JWT_SECRET: "a".repeat(32),
		});
		expect(result.success).toBe(true);
		// SMTP 平面字段不存在，通过 smtpSchema 时使用默认值
	});
});

describe("smtpSchema 校验规则", () => {
	it("全部 SMTP 字段使用默认值", () => {
		const result = smtpSchema.safeParse({});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.host).toBe("smtp.example.com");
			expect(result.data.port).toBe(587);
			expect(result.data.secure).toBe(false);
			expect(result.data.from).toBe("noreply@example.com");
		}
	});

	it("完整 SMTP 配置校验通过", () => {
		// smtpSchema 字段名为 host/port/secure 等，不是 SMTP_ 前缀
		const result = smtpSchema.safeParse({
			host: "smtp.custom.com",
			port: "465",
			secure: "true",
			user: "user",
			pass: "pass",
			from: "from@test.com",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.host).toBe("smtp.custom.com");
			expect(result.data.port).toBe(465);
			expect(result.data.secure).toBe(true);
		}
	});
});

describe("getEnv", () => {
	it("getEnv 返回 Env 类型对象", () => {
		// dotenv.config() 在模块加载时已执行，从 env/ 目录加载
		// 在测试环境中 .env 文件应存在
		const env = getEnv();
		expect(env).toHaveProperty("DATABASE_URL");
		expect(env).toHaveProperty("JWT_SECRET");
		expect(env).toHaveProperty("LOG_LEVEL");
		expect(env).toHaveProperty("NODE_ENV");
		expect(env).toHaveProperty("STORAGE_DIR");
		expect(env).toHaveProperty("SMTP");
	});
});
