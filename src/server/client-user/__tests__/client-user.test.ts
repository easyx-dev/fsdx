/**
 * 客户端用户管理测试：CRUD 操作
 */

import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#/lib/logger/logger", () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("bcryptjs", () => ({
	default: {
		hash: vi.fn().mockResolvedValue("mocked_hash"),
	},
}));

const { mockDb } = vi.hoisted(() => {
	const q = () => ({ findFirst: vi.fn(), findMany: vi.fn() });
	return {
		mockDb: {
			query: {
				clientUser: q(),
			},
			$count: vi.fn(),
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						orderBy: vi.fn(() => ({
							limit: vi.fn(() => ({ offset: vi.fn() })),
						})),
					})),
				})),
			})),
			insert: vi.fn(() => ({
				values: vi.fn(() => ({ returning: vi.fn() })),
			})),
			update: vi.fn(() => ({
				set: vi.fn(() => ({
					where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
				})),
			})),
		},
	};
});
vi.mock("#/db", () => ({ db: mockDb }));

import {
	createClientUser,
	deleteClientUser,
	getClientUser,
	getClientUserList,
	resetClientPassword,
	updateClientUser,
} from "#/server/client-user/client-user.server";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("getClientUserList", () => {
	const mockRows = [
		{
			id: "u1",
			username: "user1",
			email: "user1@test.com",
			status: "active",
			emailVerified: false,
			createdAt: new Date("2024-01-01"),
		},
		{
			id: "u2",
			username: "user2",
			email: "user2@test.com",
			status: "active",
			emailVerified: true,
			createdAt: new Date("2024-01-02"),
		},
	];

	it("返回用户列表和总数", async () => {
		mockDb.select.mockReturnValueOnce({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					orderBy: vi.fn(() => ({
						limit: vi.fn(() => ({
							offset: vi.fn().mockResolvedValue(mockRows),
						})),
					})),
				})),
			})),
		});
		mockDb.$count.mockResolvedValue(2);

		const result = await getClientUserList({ page: 1, pageSize: 20 });

		expect(result.records).toEqual(mockRows);
		expect(result.total).toBe(2);
		expect(result.page).toBe(1);
		expect(result.pageSize).toBe(20);
	});

	it("关键词搜索按 username 和 email 过滤", async () => {
		mockDb.select.mockReturnValueOnce({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					orderBy: vi.fn(() => ({
						limit: vi.fn(() => ({
							offset: vi.fn().mockResolvedValue([mockRows[0]]),
						})),
					})),
				})),
			})),
		});
		mockDb.$count.mockResolvedValue(1);

		const result = await getClientUserList({
			page: 1,
			pageSize: 20,
			keyword: "user1",
		});

		expect(result.records).toHaveLength(1);
		expect(result.total).toBe(1);
	});
});

describe("getClientUser", () => {
	it("找到用户时返回用户记录", async () => {
		const mockUser = {
			id: "u1",
			username: "testuser",
			email: "test@test.com",
		};
		mockDb.query.clientUser.findFirst.mockResolvedValue(mockUser);

		const result = await getClientUser("u1");

		expect(result).toEqual(mockUser);
	});

	it("用户不存在时返回 undefined", async () => {
		mockDb.query.clientUser.findFirst.mockResolvedValue(undefined);

		const result = await getClientUser("不存在");

		expect(result).toBeUndefined();
	});
});

describe("createClientUser", () => {
	it("创建用户并返回用户记录", async () => {
		const mockRecord = {
			id: "u1",
			username: "newuser",
			email: "new@test.com",
			status: "active",
		};
		mockDb.insert.mockReturnValue({
			values: vi.fn(() => ({
				returning: vi.fn().mockResolvedValue([mockRecord]),
			})),
		});

		const result = await createClientUser({
			username: "newuser",
			email: "new@test.com",
			password: "secret123",
		});

		expect(result).toEqual(mockRecord);
		expect(bcrypt.hash).toHaveBeenCalledWith("secret123", 12);
	});

	it("插入记录时 status 默认为 active", async () => {
		const mockRecord = {
			id: "u1",
			username: "newuser",
			email: "new@test.com",
			status: "active",
		};
		const valuesSpy = vi.fn(() => ({
			returning: vi.fn().mockResolvedValue([mockRecord]),
		}));
		mockDb.insert.mockReturnValue({ values: valuesSpy });

		await createClientUser({
			username: "newuser",
			email: "new@test.com",
			password: "secret123",
		});

		expect(valuesSpy).toHaveBeenCalledWith(
			expect.objectContaining({
				username: "newuser",
				email: "new@test.com",
				status: "active",
				passwordHash: "mocked_hash",
			}),
		);
	});
});

describe("updateClientUser", () => {
	it("部分更新用户名", async () => {
		const mockRecord = {
			id: "u1",
			username: "updated_name",
			email: "test@test.com",
		};
		mockDb.update.mockReturnValue({
			set: vi.fn(() => ({
				where: vi.fn(() => ({
					returning: vi.fn().mockResolvedValue([mockRecord]),
				})),
			})),
		});

		const result = await updateClientUser("u1", { username: "updated_name" });

		expect(result).toEqual(mockRecord);
	});

	it("部分更新邮箱和状态", async () => {
		const mockRecord = {
			id: "u1",
			username: "test",
			email: "updated@test.com",
			status: "disabled",
		};
		mockDb.update.mockReturnValue({
			set: vi.fn(() => ({
				where: vi.fn(() => ({
					returning: vi.fn().mockResolvedValue([mockRecord]),
				})),
			})),
		});

		const result = await updateClientUser("u1", {
			email: "updated@test.com",
			status: "disabled",
		});

		expect(result).toEqual(mockRecord);
	});

	it("更新邮箱验证状态", async () => {
		const mockRecord = {
			id: "u1",
			username: "test",
			email: "test@test.com",
			emailVerified: true,
		};
		mockDb.update.mockReturnValue({
			set: vi.fn(() => ({
				where: vi.fn(() => ({
					returning: vi.fn().mockResolvedValue([mockRecord]),
				})),
			})),
		});

		const result = await updateClientUser("u1", { emailVerified: true });

		expect(result).toEqual(mockRecord);
	});
});

describe("deleteClientUser", () => {
	it("用户不存在时返回 false", async () => {
		mockDb.query.clientUser.findFirst.mockResolvedValue(undefined);

		const result = await deleteClientUser("不存在");

		expect(result).toBe(false);
	});

	it("软删除成功返回 true", async () => {
		mockDb.query.clientUser.findFirst.mockResolvedValue({
			id: "u1",
			username: "deleteme",
		});

		const result = await deleteClientUser("u1");

		expect(result).toBe(true);
	});
});

describe("resetClientPassword", () => {
	it("重置密码成功返回 true", async () => {
		const mockRecord = {
			id: "u1",
			username: "testuser",
		};
		mockDb.update.mockReturnValue({
			set: vi.fn(() => ({
				where: vi.fn(() => ({
					returning: vi.fn().mockResolvedValue([mockRecord]),
				})),
			})),
		});

		const result = await resetClientPassword("u1", "newpass123");

		expect(result).toBe(true);
		expect(bcrypt.hash).toHaveBeenCalledWith("newpass123", 12);
	});

	it("用户不存在时返回 false", async () => {
		mockDb.update.mockReturnValue({
			set: vi.fn(() => ({
				where: vi.fn(() => ({
					returning: vi.fn().mockResolvedValue([]),
				})),
			})),
		});
		// update.returning 默认返回空数组，表示用户不存在或已删除
		const result = await resetClientPassword("不存在", "newpass123");

		expect(result).toBe(false);
		expect(bcrypt.hash).toHaveBeenCalledWith("newpass123", 12);
	});
});
