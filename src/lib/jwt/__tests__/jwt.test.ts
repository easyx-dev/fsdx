/**
 * JWT 签发与校验测试
 */

import { describe, expect, it, vi } from "vitest";

process.env.JWT_SECRET = "test-jwt-secret-at-least-32-characters-long!!";
process.env.DATABASE_URL = "postgres://localhost/test";
vi.mock("#/lib/logger/logger", () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { COOKIE_NAMES, signToken, verifyToken } from "#/lib/jwt/jwt";

describe("signToken / verifyToken", () => {
	it("签发后可用 verifyToken 校验并获取 payload", async () => {
		const payload = {
			userId: "user-1",
			username: "test-admin",
			userType: "admin" as const,
		};
		const token = await signToken(payload);
		expect(typeof token).toBe("string");
		expect(token.split(".")).toHaveLength(3); // JWT 三段式

		const verified = await verifyToken(token);
		expect(verified).not.toBeNull();
		expect(verified!.userId).toBe(payload.userId);
		expect(verified!.username).toBe(payload.username);
		expect(verified!.userType).toBe(payload.userType);
	});

	it("签发的 token 包含 client 类型用户", async () => {
		const payload = {
			userId: "user-2",
			username: "test-client",
			userType: "client" as const,
		};
		const token = await signToken(payload);
		const verified = await verifyToken(token);
		expect(verified!.userType).toBe("client");
	});

	it("verifyToken 校验无效 token 返回 null", async () => {
		const result = await verifyToken("invalid-token-string");
		expect(result).toBeNull();
	});

	it("verifyToken 校验空字符串返回 null", async () => {
		const result = await verifyToken("");
		expect(result).toBeNull();
	});

	it("verifyToken 校验被篡改的 token 返回 null", async () => {
		const token = await signToken({
			userId: "user-1",
			username: "test",
			userType: "admin" as const,
		});
		const parts = token.split(".");
		parts[1] = "tamperedPayload";
		const tampered = parts.join(".");
		const result = await verifyToken(tampered);
		expect(result).toBeNull();
	});
});

describe("COOKIE_NAMES", () => {
	it("ACCESS_TOKEN 名称正确", () => {
		expect(COOKIE_NAMES.ACCESS_TOKEN).toBe("cms_access_token");
	});
});
