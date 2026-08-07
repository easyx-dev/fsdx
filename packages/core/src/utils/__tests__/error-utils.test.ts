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

	it("递归脱敏 error.cause 中的敏感信息", () => {
		const cause = new Error('底层原因: {"password":"nested-secret"}');
		const err = new Error("外层错误", { cause });
		const result = sanitizeError(err);
		expect(result.cause).toBeDefined();
		const causeResult = result.cause as Record<string, unknown>;
		expect(causeResult.message).toContain("***REDACTED***");
		expect(causeResult.message).not.toContain("nested-secret");
	});

	it("error.cause 非 Error 时保留结构并脱敏内部敏感字符串", () => {
		const err = new Error("外层错误", {
			cause: { code: 503, headers: { Authorization: "Bearer sk-secret" } },
		});
		const result = sanitizeError(err);
		expect(result.cause).toEqual({
			code: 503,
			headers: { Authorization: "Bearer ***REDACTED***" },
		});
	});

	it("非 Error cause 含 password/token 时同样脱敏", () => {
		const err = new Error("外层错误", {
			cause: { body: '{"password":"p@ss","token":"t-1"}' },
		});
		const result = sanitizeError(err);
		const causeResult = result.cause as Record<string, unknown>;
		expect(causeResult.body).toContain("***REDACTED***");
		expect(causeResult.body).not.toContain("p@ss");
		expect(causeResult.body).not.toContain("t-1");
	});

	it("非 Error cause 循环引用时截断而非无限递归", () => {
		const obj: Record<string, unknown> = { name: "self-ref" };
		obj.self = obj;
		const err = new Error("循环 cause", { cause: obj });
		expect(() => sanitizeError(err)).not.toThrow();
		const causeResult = sanitizeError(err).cause as Record<string, unknown>;
		expect(causeResult.self).toBe("[cause 循环或过深，已截断]");
	});

	it("cause 循环引用时截断而非无限递归", () => {
		const err = new Error("自引用错误");
		(err as { cause?: unknown }).cause = err;
		expect(() => sanitizeError(err)).not.toThrow();
		const result = sanitizeError(err);
		const causeResult = result.cause as Record<string, unknown>;
		expect(causeResult.message).toContain("截断");
	});

	it("深层 cause 链超限时截断", () => {
		let err = new Error("最底层");
		for (let i = 0; i < 15; i++) {
			err = new Error(`第 ${i} 层`, { cause: err });
		}
		const result = sanitizeError(err);
		// 深度达到上限后不再递归，直接返回截断标记
		let depth = 0;
		let current: unknown = result;
		while (current && typeof current === "object" && "cause" in current) {
			depth += 1;
			current = (current as Record<string, unknown>).cause;
		}
		expect(depth).toBeLessThanOrEqual(12);
	});

	it("无 cause 时不输出 cause 字段", () => {
		const result = sanitizeError(new Error("无原因错误"));
		expect("cause" in result).toBe(false);
	});
});
