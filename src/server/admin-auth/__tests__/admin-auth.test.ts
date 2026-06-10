/**
 * 管理员登录逻辑测试
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#/lib/logger/logger", () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("bcryptjs", () => ({
	default: { compare: vi.fn(), hash: vi.fn() },
}));

const { mockSignToken } = vi.hoisted(() => ({
	mockSignToken: vi.fn(),
}));

vi.mock("#/lib/jwt/jwt", () => ({
	signToken: mockSignToken,
}));

const { mockDb } = vi.hoisted(() => {
	const _queryFns = () => ({ findFirst: vi.fn(), findMany: vi.fn() });
	return {
		mockDb: {
			query: {
				adminUser: _queryFns(),
				clientUser: _queryFns(),
				role: _queryFns(),
				news: _queryFns(),
				dict: _queryFns(),
				dictItem: _queryFns(),
				systemConfig: _queryFns(),
				file: _queryFns(),
				captchaCode: _queryFns(),
			},
			$count: vi.fn(),
			select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn() })) })),
			insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) })),
			update: vi.fn(() => ({
				set: vi.fn(() => ({ where: vi.fn() })),
				where: vi.fn(),
			})),
			delete: vi.fn(() => ({ where: vi.fn() })),
		},
	};
});

vi.mock("#/db", () => ({ db: mockDb }));

import bcrypt from "bcryptjs";
import { adminLogin } from "#/server/admin-auth/admin-auth.server";

describe("adminLogin", () => {
	const mockUser = {
		id: "admin-1",
		username: "admin",
		email: "admin@test.com",
		passwordHash: "hashed-pw",
		status: "active",
		deletedAt: null,
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("正确凭据登录成功，返回 token 和用户信息", async () => {
		mockDb.query.adminUser.findFirst.mockResolvedValue(mockUser);
		vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
		mockSignToken.mockResolvedValue("jwt-token-abc");

		const result = await adminLogin("admin", "correct-password");

		expect(result.success).toBe(true);
		expect(result.token).toBe("jwt-token-abc");
		expect(result.user).toEqual({
			id: "admin-1",
			username: "admin",
			email: "admin@test.com",
		});
	});

	it("用户不存在返回失败", async () => {
		mockDb.query.adminUser.findFirst.mockResolvedValue(undefined);

		const result = await adminLogin("nobody", "pw");
		expect(result.success).toBe(false);
		expect(result.message).toBe("用户名或密码错误");
	});

	it("密码错误返回失败", async () => {
		mockDb.query.adminUser.findFirst.mockResolvedValue(mockUser);
		vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

		const result = await adminLogin("admin", "wrong");
		expect(result.success).toBe(false);
		expect(result.message).toBe("用户名或密码错误");
	});

	it("用户被软删除返回失败", async () => {
		mockDb.query.adminUser.findFirst.mockResolvedValue({
			...mockUser,
			deletedAt: new Date(),
		});

		const result = await adminLogin("admin", "pw");
		expect(result.success).toBe(false);
	});

	it("用户被禁用返回失败", async () => {
		mockDb.query.adminUser.findFirst.mockResolvedValue({
			...mockUser,
			status: "disabled",
		});

		const result = await adminLogin("admin", "pw");
		expect(result.success).toBe(false);
	});

	it("登录成功后更新 lastLoginAt", async () => {
		mockDb.query.adminUser.findFirst.mockResolvedValue(mockUser);
		vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
		mockSignToken.mockResolvedValue("token");

		await adminLogin("admin", "pw");

		expect(mockDb.update).toHaveBeenCalled();
	});
});
