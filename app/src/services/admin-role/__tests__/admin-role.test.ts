/**
 * 角色管理测试：CRUD 操作
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#/lib/logger/logger", () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const { mockDb, mockRows } = vi.hoisted(() => {
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
		mockRows: rows,
		mockDb: {
			select: vi.fn(() => chain),
			$count: vi.fn(),
			insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) })),
			update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
			delete: vi.fn(() => ({ where: vi.fn() })),
		},
	};
});
vi.mock("#/db", () => ({ db: mockDb }));

import {
	createAdminRole,
	deleteAdminRole,
	getAdminRoleList,
	updateAdminRole,
} from "#/services/admin-role/admin-role.server";

describe("getAdminRoleList", () => {
	it("返回空列表", async () => {
		mockRows.mockResolvedValue([]);

		const result = await getAdminRoleList();
		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("支持关键词搜索", async () => {
		const mockRoles = [
			{ id: "r-1", name: "管理员", slug: "admin", permissions: ["**"] },
			{ id: "r-2", name: "编辑", slug: "editor", permissions: ["news:read"] },
		];
		mockRows.mockResolvedValue(mockRoles);

		const result = await getAdminRoleList("管理");
		expect(result).toHaveLength(2);
		expect(result[0].name).toBe("管理员");
	});
});

describe("createAdminRole", () => {
	it("创建角色成功", async () => {
		const mockRecord = {
			id: "r-new",
			name: "新角色",
			slug: "new_role",
			permissions: ["news:read"],
			description: null,
		};
		mockDb.insert.mockReturnValue({
			values: vi.fn(() => ({
				returning: vi.fn().mockResolvedValue([mockRecord]),
			})),
		});

		const result = await createAdminRole({
			name: "新角色",
			slug: "new_role",
			permissions: ["news:read"],
		});
		expect(result.id).toBe("r-new");
		expect(result.name).toBe("新角色");
		expect(result.slug).toBe("new_role");
	});
});

describe("updateAdminRole", () => {
	it("部分更新角色名称", async () => {
		const mockRecord = {
			id: "r-1",
			name: "超级管理员",
			slug: "admin",
			permissions: ["**"],
		};
		mockDb.update.mockReturnValue({
			set: vi.fn(() => ({
				where: vi.fn(() => ({
					returning: vi.fn().mockResolvedValue([mockRecord]),
				})),
			})),
		});

		const result = await updateAdminRole("r-1", { name: "超级管理员" });
		expect(result?.name).toBe("超级管理员");
	});

	it("部分更新角色权限", async () => {
		const mockRecord = {
			id: "r-1",
			name: "管理员",
			slug: "admin",
			permissions: ["**", "news:write"],
		};
		mockDb.update.mockReturnValue({
			set: vi.fn(() => ({
				where: vi.fn(() => ({
					returning: vi.fn().mockResolvedValue([mockRecord]),
				})),
			})),
		});

		const result = await updateAdminRole("r-1", {
			permissions: ["**", "news:write"],
		});
		expect(result?.permissions).toEqual(["**", "news:write"]);
	});
});

describe("deleteAdminRole", () => {
	beforeEach(() => vi.clearAllMocks());

	it("角色不存在时返回 false", async () => {
		mockRows.mockResolvedValue([]);

		const result = await deleteAdminRole("不存在的ID");
		expect(result).toBe(false);
	});

	it("删除成功返回 true", async () => {
		mockRows.mockResolvedValue([
			{
				id: "r-1",
				name: "旧角色",
				slug: "old_role",
			},
		]);

		const result = await deleteAdminRole("r-1");
		expect(result).toBe(true);
	});
});
