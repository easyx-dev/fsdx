/**
 * getCurrentClient 逻辑测试：JWT 解析 + 客户端用户查询
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

// 通过 vi.hoisted 持有 mock 对象引用，避免在测试中直接 import 缓存实例
const { mockCacheMethods } = vi.hoisted(() => {
	const cacheStore = new Map();
	return {
		mockCacheMethods: {
			get: vi.fn((key: string) => cacheStore.get(key)),
			set: vi.fn((key: string, value: unknown) => cacheStore.set(key, value)),
			clear: vi.fn(() => cacheStore.clear()),
		},
	};
});
vi.mock("#/lib/cache/cache", () => ({ clientUserCache: mockCacheMethods }));

import { getCurrentClient } from "#/server/client-auth/client-auth.server";

describe("getCurrentClient", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockCacheMethods.clear();
	});

	it("token 为 undefined 返回 null", async () => {
		const result = await getCurrentClient(undefined);
		expect(result).toBeNull();
	});

	it("无效 token 返回 null", async () => {
		mockVerifyToken.mockResolvedValue(null);
		const result = await getCurrentClient("invalid-token");
		expect(result).toBeNull();
	});

	it("admin 类型 token 返回 null", async () => {
		mockVerifyToken.mockResolvedValue({
			userId: "admin-1",
			username: "admin",
			userType: "admin",
		});
		const result = await getCurrentClient("admin-token");
		expect(result).toBeNull();
	});

	it("有效 client token 返回客户端用户信息", async () => {
		mockVerifyToken.mockResolvedValue({
			userId: "c-1",
			username: "client",
			userType: "client",
		});
		mockDb.query.clientUser.findFirst.mockResolvedValue({
			id: "c-1",
			username: "client",
			email: "c@t.com",
			avatar: null,
			status: "active",
			deletedAt: null,
		});

		const result = await getCurrentClient("valid-token");
		expect(result).toMatchObject({
			id: "c-1",
			username: "client",
			email: "c@t.com",
			isRoot: false,
			userType: "client",
		});
	});

	it("client 用户被禁用返回 null", async () => {
		mockVerifyToken.mockResolvedValue({
			userId: "c-1",
			username: "client",
			userType: "client",
		});
		mockDb.query.clientUser.findFirst.mockResolvedValue({
			id: "c-1",
			username: "client",
			email: "c@t.com",
			status: "disabled",
			deletedAt: null,
		});

		const result = await getCurrentClient("valid-token");
		expect(result).toBeNull();
	});
});
