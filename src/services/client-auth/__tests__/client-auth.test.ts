/**
 * 客户端用户认证逻辑测试（登录 + 注册）
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#/lib/logger/logger", () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("bcryptjs", () => ({
	default: { compare: vi.fn(), hash: vi.fn() },
}));

const { mockSignToken } = vi.hoisted(() => ({ mockSignToken: vi.fn() }));
vi.mock("#/lib/jwt/jwt", () => ({ signToken: mockSignToken }));

const { mockVerifyCaptcha } = vi.hoisted(() => ({
	mockVerifyCaptcha: vi.fn(),
}));
vi.mock("#/services/captcha/captcha.server", () => ({
	verifyCaptcha: mockVerifyCaptcha,
}));

const { mockDb } = vi.hoisted(() => {
	const q = () => ({ findFirst: vi.fn(), findMany: vi.fn() });
	return {
		mockDb: {
			query: {
				clientUser: q(),
				adminUser: q(),
				role: q(),
				news: q(),
				dict: q(),
				dictItem: q(),
				systemConfig: q(),
				file: q(),
				captchaCode: q(),
			},
			$count: vi.fn(),
			select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn() })) })),
			insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) })),
			update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
			delete: vi.fn(() => ({ where: vi.fn() })),
		},
	};
});
vi.mock("#/db", () => ({ db: mockDb }));

import bcrypt from "bcryptjs";
import {
	clientLogin,
	clientRegister,
} from "#/services/client-auth/client-auth.server";

const mockClientUser = {
	id: "client-1",
	username: "testuser",
	email: "test@test.com",
	passwordHash: "hashed",
	status: "active",
	deletedAt: null,
};

describe("clientLogin", () => {
	beforeEach(() => vi.clearAllMocks());

	it("正确凭据登录成功", async () => {
		mockDb.query.clientUser.findFirst.mockResolvedValue(mockClientUser);
		vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
		mockSignToken.mockResolvedValue("jwt-token");

		const result = await clientLogin("testuser", "pw");
		expect(result.success).toBe(true);
		expect(result.token).toBe("jwt-token");
	});

	it("用户不存在返回失败", async () => {
		mockDb.query.clientUser.findFirst.mockResolvedValue(undefined);
		const result = await clientLogin("nobody", "pw");
		expect(result.success).toBe(false);
	});

	it("密码错误返回失败", async () => {
		mockDb.query.clientUser.findFirst.mockResolvedValue(mockClientUser);
		vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
		const result = await clientLogin("testuser", "wrong");
		expect(result.success).toBe(false);
	});

	it("用户被禁用返回失败", async () => {
		mockDb.query.clientUser.findFirst.mockResolvedValue({
			...mockClientUser,
			status: "disabled",
		});
		const result = await clientLogin("testuser", "pw");
		expect(result.success).toBe(false);
	});
});

describe("clientRegister", () => {
	beforeEach(() => vi.clearAllMocks());

	it("注册成功", async () => {
		mockVerifyCaptcha.mockResolvedValue(true);
		mockDb.query.clientUser.findFirst.mockResolvedValue(undefined);
		vi.mocked(bcrypt.hash).mockResolvedValue("hashed-pw" as never);

		const result = await clientRegister(
			"newuser",
			"new@test.com",
			"password123",
			"123456",
		);
		expect(result.success).toBe(true);
		expect(result.message).toBe("注册成功");
		expect(mockDb.insert).toHaveBeenCalled();
	});

	it("验证码错误返回失败", async () => {
		mockVerifyCaptcha.mockResolvedValue(false);
		const result = await clientRegister("u", "e@t.com", "pw", "000000");
		expect(result.success).toBe(false);
		expect(result.message).toBe("验证码错误或已过期");
	});

	it("用户名或邮箱已存在返回失败", async () => {
		mockVerifyCaptcha.mockResolvedValue(true);
		mockDb.query.clientUser.findFirst.mockResolvedValue(mockClientUser);
		const result = await clientRegister(
			"testuser",
			"test@test.com",
			"pw",
			"123456",
		);
		expect(result.success).toBe(false);
		expect(result.message).toBe("用户名或邮箱已存在");
	});
});
