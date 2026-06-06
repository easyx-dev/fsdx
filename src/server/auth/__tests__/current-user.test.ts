/**
 * getCurrentUser 逻辑测试：JWT 解析 + 用户查询
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockVerifyToken } = vi.hoisted(() => ({ mockVerifyToken: vi.fn() }));
vi.mock("#/lib/jwt/jwt", () => ({ verifyToken: mockVerifyToken }));

const { mockDb } = vi.hoisted(() => {
	const q = () => ({ findFirst: vi.fn(), findMany: vi.fn() });
	return {
		mockDb: {
			query: {
				adminUser: q(),
				clientUser: q(),
				role: q(),
				news: q(),
				dict: q(),
				dictItem: q(),
				systemConfig: q(),
				file: q(),
				captchaCode: q(),
				todos: q(),
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

import { getCurrentUser } from "#/server/auth";

describe("getCurrentUser", () => {
	beforeEach(() => vi.clearAllMocks());

	it("token 为 undefined 返回 null", async () => {
		const result = await getCurrentUser(undefined);
		expect(result).toBeNull();
	});

	it("无效 token 返回 null", async () => {
		mockVerifyToken.mockResolvedValue(null);
		const result = await getCurrentUser("invalid-token");
		expect(result).toBeNull();
	});

	it("有效 admin token 返回用户信息", async () => {
		mockVerifyToken.mockResolvedValue({
			userId: "admin-1",
			username: "admin",
			userType: "admin",
		});
		mockDb.query.adminUser.findFirst.mockResolvedValue({
			id: "admin-1",
			username: "admin",
			email: "admin@t.com",
			status: "active",
			deletedAt: null,
		});

		const result = await getCurrentUser("valid-token");
		expect(result).toEqual({
			id: "admin-1",
			username: "admin",
			email: "admin@t.com",
			userType: "admin",
		});
	});

	it("有效 client token 返回用户信息", async () => {
		mockVerifyToken.mockResolvedValue({
			userId: "c-1",
			username: "client",
			userType: "client",
		});
		mockDb.query.clientUser.findFirst.mockResolvedValue({
			id: "c-1",
			username: "client",
			email: "c@t.com",
			status: "active",
			deletedAt: null,
		});

		const result = await getCurrentUser("valid-token");
		expect(result).toEqual({
			id: "c-1",
			username: "client",
			email: "c@t.com",
			userType: "client",
		});
	});

	it("admin 用户被软删除返回 null", async () => {
		mockVerifyToken.mockResolvedValue({
			userId: "admin-1",
			username: "admin",
			userType: "admin",
		});
		mockDb.query.adminUser.findFirst.mockResolvedValue({
			id: "admin-1",
			username: "admin",
			email: "a@t.com",
			status: "active",
			deletedAt: new Date(),
		});

		const result = await getCurrentUser("valid-token");
		expect(result).toBeNull();
	});
});
