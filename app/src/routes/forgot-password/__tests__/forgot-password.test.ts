/**
 * 客户端忘记密码核心逻辑测试
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	mockDb,
	mockRows,
	mockBcrypt,
	mockVerifyCaptcha,
	mockClearClientUserCache,
	mockLogger,
} = vi.hoisted(() => {
	const rows = vi.fn().mockResolvedValue([]);
	const chain: any = {
		from: vi.fn(() => chain),
		where: vi.fn(() => chain),
		orderBy: vi.fn(() => chain),
		limit: vi.fn(() => chain),
		offset: vi.fn(() => chain),
		innerJoin: vi.fn(() => chain),
	};
	Object.defineProperty(chain, "then", {
		value: (onFulfilled: (value: unknown) => unknown) =>
			rows().then(onFulfilled),
	});
	return {
		mockDb: {
			select: vi.fn(() => chain),
			update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
		},
		mockRows: rows,
		mockBcrypt: { hash: vi.fn() },
		mockVerifyCaptcha: vi.fn(),
		mockClearClientUserCache: vi.fn(),
		mockLogger: {
			info: vi.fn(),
			debug: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		},
	};
});

vi.mock("#/db/index", () => ({ db: mockDb }));
vi.mock("bcryptjs", () => ({ default: mockBcrypt }));
vi.mock("#/services/captcha/captcha.server", () => ({
	verifyCaptcha: mockVerifyCaptcha,
}));
vi.mock("#/services/client-auth/client-auth.server", () => ({
	clearClientUserCache: mockClearClientUserCache,
}));
vi.mock("#/lib/logger/logger", () => ({ logger: mockLogger }));

import { resetClientPassword } from "../-mods/forgot-password.server";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("resetClientPassword", () => {
	it("验证码错误返回失败", async () => {
		mockVerifyCaptcha.mockResolvedValue(false);

		const result = await resetClientPassword("u@t.com", "123456", "newpass");

		expect(result.success).toBe(false);
		expect(result.message).toBe("验证码错误或已过期");
		expect(mockDb.select).not.toHaveBeenCalled();
	});

	it("用户不存在返回失败", async () => {
		mockVerifyCaptcha.mockResolvedValue(true);
		mockRows.mockResolvedValue([]);

		const result = await resetClientPassword("u@t.com", "123456", "newpass");

		expect(result.success).toBe(false);
		expect(result.message).toBe("该邮箱未注册");
	});

	it("用户已删除返回失败", async () => {
		mockVerifyCaptcha.mockResolvedValue(true);
		mockRows.mockResolvedValue([
			{
				id: "u-1",
				email: "u@t.com",
				status: "active",
				deletedAt: new Date(),
			},
		]);

		const result = await resetClientPassword("u@t.com", "123456", "newpass");

		expect(result.success).toBe(false);
		expect(result.message).toBe("该邮箱未注册");
	});

	it("用户已禁用返回失败", async () => {
		mockVerifyCaptcha.mockResolvedValue(true);
		mockRows.mockResolvedValue([
			{
				id: "u-1",
				email: "u@t.com",
				status: "disabled",
			},
		]);

		const result = await resetClientPassword("u@t.com", "123456", "newpass");

		expect(result.success).toBe(false);
		expect(result.message).toBe("该账号已被禁用");
	});

	it("正常重置密码成功", async () => {
		mockVerifyCaptcha.mockResolvedValue(true);
		mockRows.mockResolvedValue([
			{
				id: "u-1",
				email: "u@t.com",
				status: "active",
			},
		]);
		mockBcrypt.hash.mockResolvedValue("hashed_pwd");

		const result = await resetClientPassword("u@t.com", "123456", "newpass");

		expect(result.success).toBe(true);
		expect(result.message).toBe("密码重置成功");
		expect(mockDb.update).toHaveBeenCalled();
	});

	it("调用 bcrypt.hash 时使用正确的 rounds=10", async () => {
		mockVerifyCaptcha.mockResolvedValue(true);
		mockRows.mockResolvedValue([
			{
				id: "u-1",
				email: "u@t.com",
				status: "active",
			},
		]);
		mockBcrypt.hash.mockResolvedValue("hashed_pwd");

		await resetClientPassword("u@t.com", "123456", "newpass");

		expect(mockBcrypt.hash).toHaveBeenCalledWith("newpass", 10);
	});

	it("成功时清除用户缓存", async () => {
		mockVerifyCaptcha.mockResolvedValue(true);
		mockRows.mockResolvedValue([
			{
				id: "u-1",
				email: "u@t.com",
				status: "active",
			},
		]);
		mockBcrypt.hash.mockResolvedValue("hashed_pwd");

		await resetClientPassword("u@t.com", "123456", "newpass");

		expect(mockClearClientUserCache).toHaveBeenCalledWith("u-1");
	});
});
