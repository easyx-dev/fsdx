/**
 * getCurrentAdmin 逻辑测试：JWT 解析 + 管理员查询
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockVerifyToken } = vi.hoisted(() => ({ mockVerifyToken: vi.fn() }));
vi.mock("#/lib/jwt/jwt", () => ({ jwt: { verifyToken: mockVerifyToken } }));

const { mockDb } = vi.hoisted(() => {
	const q = () => ({ findFirst: vi.fn(), findMany: vi.fn() });
	return {
		mockDb: {
			query: {
				adminUser: q(),
				clientUser: q(),
				adminRole: q(),
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

import { getCurrentAdmin } from "#/services/admin-auth/admin-auth.server";

describe("getCurrentAdmin", () => {
	beforeEach(() => vi.clearAllMocks());

	it("token 为 undefined 返回 null", async () => {
		const result = await getCurrentAdmin(undefined);
		expect(result).toBeNull();
	});

	it("无效 token 返回 null", async () => {
		mockVerifyToken.mockResolvedValue(null);
		const result = await getCurrentAdmin("invalid-token");
		expect(result).toBeNull();
	});

	it("client 类型 token 返回 null", async () => {
		mockVerifyToken.mockResolvedValue({
			userId: "c-1",
			username: "client",
			userType: "client",
		});
		const result = await getCurrentAdmin("client-token");
		expect(result).toBeNull();
	});

	it("有效 admin token 返回管理员信息", async () => {
		mockVerifyToken.mockResolvedValue({
			userId: "admin-1",
			username: "admin",
			userType: "admin",
		});
		mockDb.query.adminUser.findFirst.mockResolvedValue({
			id: "admin-1",
			username: "admin",
			email: "admin@t.com",
			isRoot: false,
			adminRoleIds: ["role-1"],
			status: "active",
			deletedAt: null,
		});
		mockDb.query.adminRole.findMany.mockResolvedValue([
			{ name: "编辑者" },
			{ name: "审核者" },
		]);

		const result = await getCurrentAdmin("valid-token");
		expect(result).toMatchObject({
			id: "admin-1",
			username: "admin",
			email: "admin@t.com",
			userType: "admin",
			isRoot: false,
			roleNames: ["编辑者", "审核者"],
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

		const result = await getCurrentAdmin("valid-token");
		expect(result).toBeNull();
	});
});
