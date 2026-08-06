/**
 * 客户端角色管理测试：CRUD 操作
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#/lib/logger/logger", () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const { mockDb } = vi.hoisted(() => {
	const q = () => ({ findFirst: vi.fn(), findMany: vi.fn() });
	return {
		mockDb: {
			query: {
				clientRole: q(),
				adminRole: q(),
				adminUser: q(),
				clientUser: q(),
				dict: q(),
				dictItem: q(),
				news: q(),
				systemConfig: q(),
				file: q(),
				captchaCode: q(),
			},
			$count: vi.fn(),
			select: vi.fn(() => ({
				from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn() })) })),
			})),
			insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) })),
			update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
			delete: vi.fn(() => ({ where: vi.fn() })),
		},
	};
});
vi.mock("#/db", () => ({ db: mockDb }));

import {
	createClientRole,
	deleteClientRole,
	getClientRoleList,
	updateClientRole,
} from "#/services/client-role/client-role.server";

describe("getClientRoleList", () => {
	it("返回空列表", async () => {
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn(() => ({ orderBy: vi.fn().mockResolvedValue([]) })),
			})),
		});

		const result = await getClientRoleList();
		expect(Array.isArray(result)).toBe(true);
		expect(result).toHaveLength(0);
	});

	it("支持关键词搜索", async () => {
		const mockRoles = [
			{
				id: "r-1",
				name: "超级用户",
				slug: "client-super-admin",
				permissions: ["**"],
			},
			{ id: "r-2", name: "普通用户", slug: "normal-user", permissions: [] },
		];
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					orderBy: vi.fn().mockResolvedValue(mockRoles),
				})),
			})),
		});

		const result = await getClientRoleList("用户");
		expect(result).toHaveLength(2);
		expect(result[0].name).toBe("超级用户");
	});
});

describe("createClientRole", () => {
	it("创建角色成功", async () => {
		const mockRecord = {
			id: "r-new",
			name: "新角色",
			slug: "new_role",
			permissions: [],
			description: null,
		};
		mockDb.insert.mockReturnValue({
			values: vi.fn(() => ({
				returning: vi.fn().mockResolvedValue([mockRecord]),
			})),
		});

		const result = await createClientRole({
			name: "新角色",
			slug: "new_role",
			permissions: [],
		});
		expect(result.id).toBe("r-new");
		expect(result.name).toBe("新角色");
		expect(result.slug).toBe("new_role");
	});
});

describe("updateClientRole", () => {
	it("部分更新角色名称", async () => {
		const mockRecord = {
			id: "r-1",
			name: "超级用户",
			slug: "client-super-admin",
			permissions: ["**"],
		};
		mockDb.update.mockReturnValue({
			set: vi.fn(() => ({
				where: vi.fn(() => ({
					returning: vi.fn().mockResolvedValue([mockRecord]),
				})),
			})),
		});

		const result = await updateClientRole("r-1", { name: "超级用户" });
		expect(result?.name).toBe("超级用户");
	});

	it("部分更新角色权限", async () => {
		const mockRecord = {
			id: "r-1",
			name: "超级用户",
			slug: "client-super-admin",
			permissions: ["**"],
		};
		mockDb.update.mockReturnValue({
			set: vi.fn(() => ({
				where: vi.fn(() => ({
					returning: vi.fn().mockResolvedValue([mockRecord]),
				})),
			})),
		});

		const result = await updateClientRole("r-1", { permissions: ["**"] });
		expect(result?.permissions).toEqual(["**"]);
	});
});

describe("deleteClientRole", () => {
	beforeEach(() => vi.clearAllMocks());

	it("角色不存在时返回 false", async () => {
		mockDb.query.clientRole.findFirst.mockResolvedValue(undefined);

		const result = await deleteClientRole("不存在的ID");
		expect(result).toBe(false);
	});

	it("删除成功返回 true", async () => {
		mockDb.query.clientRole.findFirst.mockResolvedValue({
			id: "r-1",
			name: "旧角色",
			slug: "old_role",
		});

		const result = await deleteClientRole("r-1");
		expect(result).toBe(true);
	});
});
