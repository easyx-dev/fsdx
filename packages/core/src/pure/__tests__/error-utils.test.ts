/**
 * 错误脱敏工具测试：sanitizeError 敏感信息脱敏
 */

import { describe, expect, it } from "vitest";
import { sanitizeError } from "../error-utils";

describe("sanitizeError", () => {
	it("对 Error 对象进行脱敏并返回 name 和 message", () => {
		const err = new Error("操作失败: password 错误");
		const result = sanitizeError(err);
		expect(result.name).toBe("Error");
		expect(result.message).toBeDefined();
	});

	it("脱敏 password JSON 字段", () => {
		const err = new Error(
			'请求参数: {"password":"secret123","username":"admin"}',
		);
		const result = sanitizeError(err);
		expect(result.message).toContain("***REDACTED***");
		expect(result.message).not.toContain("secret123");
	});

	it("脱敏 token JSON 字段", () => {
		const err = new Error(
			'认证失败: {"token":"eyJhbGciOiJIUzI1NiJ9.xxx","user":"admin"}',
		);
		const result = sanitizeError(err);
		expect(result.message).toContain("***REDACTED***");
		expect(result.message).not.toContain("eyJhbGci");
	});

	it("脱敏单引号 token 字段", () => {
		const err = new Error("参数: 'token':'abc123','user':'admin'");
		const result = sanitizeError(err);
		expect(result.message).toContain("***REDACTED***");
		expect(result.message).not.toContain("abc123");
	});

	it("脱敏 Bearer Token", () => {
		const err = new Error("Unauthorized: Bearer sk-1234567890abcdef");
		const result = sanitizeError(err);
		expect(result.message).toContain("***REDACTED***");
		expect(result.message).not.toContain("sk-1234567890abcdef");
	});

	it("脱敏 secret 参数", () => {
		const err = new Error("配置错误: secret=my-api-key-123");
		const result = sanitizeError(err);
		expect(result.message).toContain("***REDACTED***");
		expect(result.message).not.toContain("my-api-key-123");
	});

	it("非 Error 类型返回 message 字符串", () => {
		const result = sanitizeError("plain string error");
		expect(result.message).toBe("plain string error");
	});

	it("非 Error 对象返回转换后的字符串", () => {
		const result = sanitizeError({ code: 500 });
		expect(result.message).toBe("[object Object]");
	});

	it("不含敏感信息的错误原样保留", () => {
		const err = new Error("数据库连接失败");
		const result = sanitizeError(err);
		expect(result.message).toBe("数据库连接失败");
	});
});
