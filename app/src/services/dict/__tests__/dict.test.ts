/**
 * 字典管理测试：CRUD + 缓存操作
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#/lib/logger/logger", () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const { mockDictCache } = vi.hoisted(() => {
	const store = new Map<string, Record<string, string>>();
	return {
		mockDictCache: {
			get: vi.fn((k: string) => store.get(k)),
			set: vi.fn((k: string, v: Record<string, string>) => {
				store.set(k, v);
			}),
			clear: vi.fn(() => store.clear()),
			keys: vi.fn(() => Array.from(store.keys())),
		},
	};
});
vi.mock("#/services/dict/dict.cache", () => ({ dictCache: mockDictCache }));

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
			transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
				const txMock = {
					update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
					delete: vi.fn(() => ({ where: vi.fn() })),
				};
				await fn(txMock);
			}),
		},
	};
});
vi.mock("#/db", () => ({ db: mockDb, withTransaction: mockDb.transaction }));

import {
	createDict,
	deleteDict,
	ensurePresetDicts,
	getAllDictOptions,
	getDictList,
} from "#/services/dict/dict.server";

describe("getDictList", () => {
	it("返回字典列表", async () => {
		mockRows.mockResolvedValue([]);
		const result = await getDictList();
		expect(Array.isArray(result)).toBe(true);
	});
});
describe("createDict", () => {
	it("创建字典并更新缓存", async () => {
		mockDb.insert.mockReturnValue({
			values: vi.fn(() => ({
				returning: vi
					.fn()
					.mockResolvedValue([
						{ id: "d-1", slug: "test_dict", name: "测试字典" },
					]),
			})),
		});

		const result = await createDict({ name: "测试字典", slug: "test_dict" });
		expect(result.slug).toBe("test_dict");
		expect(mockDictCache.set).toHaveBeenCalledWith("test_dict", {});
	});
});
describe("deleteDict", () => {
	beforeEach(() => vi.clearAllMocks());
	it("删除成功返回 true", async () => {
		// findFirst 返回存在记录，loadDictCache 的两个 select 返回空
		mockRows
			.mockReset()
			.mockResolvedValueOnce([{ id: "d-1", slug: "old_dict" }])
			.mockResolvedValue([]);
		mockDictCache.set("old_dict", {});
		const result = await deleteDict("d-1");
		expect(result).toBe(true);
	});
	it("不存在的字典返回 false", async () => {
		mockRows.mockReset().mockResolvedValue([]);
		const result = await deleteDict("不存在");
		expect(result).toBe(false);
	});
});

describe("getAllDictOptions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockDictCache.clear();
	});

	it("按 slug 分组返回字典选项", async () => {
		// 预置缓存：user_status 两个选项 + news_status 一个选项
		mockDictCache.set("user_status", {
			active: { label: "启用", color: "green" },
			disabled: { label: "禁用", color: "red" },
		} as any);
		mockDictCache.set("news_status", {
			published: { label: "已发布", color: "blue" },
		} as any);
		mockRows.mockResolvedValue([]);

		const result = await getAllDictOptions();

		expect(result).toEqual({
			user_status: [
				{ label: "启用", value: "active", color: "green" },
				{ label: "禁用", value: "disabled", color: "red" },
			],
			news_status: [{ label: "已发布", value: "published", color: "blue" }],
		});
	});

	it("无缓存数据时返回空对象", async () => {
		mockRows.mockResolvedValue([]);

		const result = await getAllDictOptions();

		expect(result).toEqual({});
	});
});

describe("ensurePresetDicts", () => {
	beforeEach(() => vi.clearAllMocks());

	it("全部预置字典缺失时逐个创建并写入子项", async () => {
		mockRows.mockReset().mockResolvedValue([]);
		mockDb.insert.mockReturnValue({
			values: vi.fn(() => ({
				returning: vi
					.fn()
					.mockResolvedValue([
						{ id: "d-1", slug: "user_status", name: "用户状态" },
					]),
			})),
		});

		await ensurePresetDicts();

		expect(mockDb.select).toHaveBeenCalledTimes(2);
		expect(mockDb.insert).toHaveBeenCalled();
	});

	it("预置字典已存在时跳过创建", async () => {
		mockRows.mockReset().mockResolvedValue([
			{
				id: "d-1",
				slug: "user_status",
				name: "用户状态",
			},
		]);

		await ensurePresetDicts();

		expect(mockDb.insert).not.toHaveBeenCalled();
	});
});
