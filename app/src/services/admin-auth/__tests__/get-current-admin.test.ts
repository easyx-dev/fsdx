/**
 * getCurrentAdmin 逻辑测试：JWT 解析 + 管理员查询
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

/** 捕获 findFirst 传入的 where 回调，用哨兵值验证条件组合是否完整 */
let capturedWhere:
	| ((
			table: object,
			helpers: Record<string, (...a: never[]) => unknown>,
	  ) => unknown)
	| undefined;

function captureWhere(where?: (t: object, helpers: any) => unknown): void {
	capturedWhere = where;
}

/** 哨兵 SQL 运算符：每个运算符返回可区分的结果，便于断言 and/eq/isNull 是否都被使用 */
const sentinelHelpers = {
	eq: () => "EQ",
	isNull: () => "ISNULL",
};

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
	beforeEach(() => {
		vi.clearAllMocks();
		capturedWhere = undefined;
	});

	it("查询管理员时 where 条件同时包含 id 等值与未删除约束（防止 && 吞条件）", async () => {
		mockVerifyToken.mockResolvedValue({
			userId: "admin-1",
			username: "admin",
			userType: "admin",
		});
		mockDb.query.adminUser.findFirst.mockImplementation(
			(opts: {
				where?: (
					t: object,
					helpers: Record<string, (...a: never[]) => unknown>,
				) => unknown;
			}) => {
				captureWhere(opts.where);
				return Promise.resolve({
					id: "admin-1",
					username: "admin",
					email: "admin@t.com",
					isRoot: false,
					adminRoleIds: ["role-1"],
					status: "active",
					deletedAt: null,
				});
			},
		);
		mockDb.query.adminRole.findMany.mockResolvedValue([{ name: "编辑者" }]);

		await getCurrentAdmin("valid-token");

		expect(capturedWhere).toBeDefined();
		const result = capturedWhere!({ id: "admin-1" }, sentinelHelpers);
		// and 为模块级 drizzle 组合器，最终 SQL 需同时含 id 等值与未删除两个条件
		const serialized = JSON.stringify(result);
		expect(serialized).toContain("EQ");
		expect(serialized).toContain("ISNULL");
	});

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
