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
	jwt: { signToken: mockSignToken },
}));

const { mockDb } = vi.hoisted(() => {
	const _queryFns = () => ({ findFirst: vi.fn(), findMany: vi.fn() });
	return {
		mockDb: {
			query: {
				adminUser: _queryFns(),
				adminRole: _queryFns(),
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
import {
	adminLogin,
	getAdminUserForAuth,
} from "#/services/admin-auth/admin-auth.server";
import { adminUserCache } from "#/services/admin-auth/admin-user.cache";

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

describe("getAdminUserForAuth", () => {
	const cachedUser = {
		id: "admin-1",
		username: "admin",
		email: "admin@test.com",
		avatar: null,
		isRoot: false,
		adminRoleIds: ["role-1"],
		status: "active",
	};

	beforeEach(() => {
		vi.clearAllMocks();
		adminUserCache.clear();
	});

	it("缓存命中且未启用时返回 disabled", async () => {
		adminUserCache.set("admin-1", { ...cachedUser, status: "disabled" });

		const result = await getAdminUserForAuth("admin-1");

		expect(result).toEqual({ success: false, reason: "disabled" });
		expect(mockDb.query.adminUser.findFirst).not.toHaveBeenCalled();
	});

	it("缓存命中且是 root 用户时返回通配权限", async () => {
		adminUserCache.set("admin-1", { ...cachedUser, isRoot: true });

		const result = await getAdminUserForAuth("admin-1");

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.isRoot).toBe(true);
			expect(result.rolePermissions).toEqual(["**"]);
		}
		expect(mockDb.query.adminRole.findMany).not.toHaveBeenCalled();
	});

	it("缓存命中且非 root 时合并角色权限并去重", async () => {
		adminUserCache.set("admin-1", cachedUser);
		mockDb.query.adminRole.findMany.mockResolvedValue([
			{ id: "role-1", permissions: ["news:view", "news:create"] },
			{ id: "role-2", permissions: ["news:view", "dict:view"] },
		]);

		const result = await getAdminUserForAuth("admin-1");

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.rolePermissions).toEqual([
				"news:view",
				"news:create",
				"dict:view",
			]);
		}
	});

	it("缓存命中且无角色时权限为空数组", async () => {
		adminUserCache.set("admin-1", { ...cachedUser, adminRoleIds: [] });

		const result = await getAdminUserForAuth("admin-1");

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.rolePermissions).toEqual([]);
		}
		expect(mockDb.query.adminRole.findMany).not.toHaveBeenCalled();
	});

	it("缓存未命中且用户不存在时返回 not_found", async () => {
		mockDb.query.adminUser.findFirst.mockResolvedValue(undefined);

		const result = await getAdminUserForAuth("ghost");

		expect(result).toEqual({ success: false, reason: "not_found" });
	});

	it("缓存未命中且用户未启用时返回 disabled", async () => {
		mockDb.query.adminUser.findFirst.mockResolvedValue({
			...cachedUser,
			status: "disabled",
		});

		const result = await getAdminUserForAuth("admin-1");

		expect(result).toEqual({ success: false, reason: "disabled" });
	});

	it("缓存未命中且是 root 用户时返回通配权限并写入缓存", async () => {
		mockDb.query.adminUser.findFirst.mockResolvedValue({
			...cachedUser,
			isRoot: true,
		});

		const result = await getAdminUserForAuth("admin-1");

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.rolePermissions).toEqual(["**"]);
		}
		expect(adminUserCache.has("admin-1")).toBe(true);
		expect(mockDb.query.adminRole.findMany).not.toHaveBeenCalled();
	});

	it("缓存未命中且非 root 时查询角色合并权限", async () => {
		mockDb.query.adminUser.findFirst.mockResolvedValue(cachedUser);
		mockDb.query.adminRole.findMany.mockResolvedValue([
			{ id: "role-1", permissions: ["news:view"] },
		]);

		const result = await getAdminUserForAuth("admin-1");

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.rolePermissions).toEqual(["news:view"]);
		}
	});
});
