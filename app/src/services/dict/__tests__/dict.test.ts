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

const { mockDb } = vi.hoisted(() => {
	const q = () => ({ findFirst: vi.fn(), findMany: vi.fn() });
	return {
		mockDb: {
			query: {
				dict: q(),
				dictItem: q(),
				adminUser: q(),
				clientUser: q(),
				role: q(),
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
			transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => {
				const txMock = {
					update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
					delete: vi.fn(() => ({ where: vi.fn() })),
				};
				await fn(txMock);
			}),
			innerJoin: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn() })) })),
		},
	};
});
vi.mock("#/db", () => ({ db: mockDb }));

import {
	createDict,
	deleteDict,
	ensurePresetDicts,
	getAllDictOptions,
	getDictList,
} from "#/services/dict/dict.server";

describe("getDictList", () => {
	it("返回字典列表", async () => {
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn(() => ({ orderBy: vi.fn().mockResolvedValue([]) })),
			})),
		});
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
		mockDb.query.dict.findFirst.mockResolvedValue({
			id: "d-1",
			slug: "old_dict",
		});
		mockDictCache.set("old_dict", {});
		// mock loadDictCache 中的两个 Promise.all 查询
		// db.select().from(dict).where(...) 查询链
		const mockFromResult = vi.fn(() => ({
			where: vi.fn().mockResolvedValue([]), // where 返回 Promise，值可被 iterable
			innerJoin: vi.fn(() => ({
				where: vi.fn(() => ({ orderBy: vi.fn().mockResolvedValue([]) })),
			})),
		}));
		mockDb.select.mockImplementation(
			(_args?: unknown) =>
				({
					from: mockFromResult,
				}) as any,
		);
		const result = await deleteDict("d-1");
		expect(result).toBe(true);
	});
	it("不存在的字典返回 false", async () => {
		mockDb.query.dict.findFirst.mockResolvedValue(undefined);
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
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn(() => ({ orderBy: vi.fn().mockResolvedValue([]) })),
				innerJoin: vi.fn(() => ({
					where: vi.fn(() => ({ orderBy: vi.fn().mockResolvedValue([]) })),
				})),
			})),
		});

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
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn(() => ({ orderBy: vi.fn().mockResolvedValue([]) })),
				innerJoin: vi.fn(() => ({
					where: vi.fn(() => ({ orderBy: vi.fn().mockResolvedValue([]) })),
				})),
			})),
		});

		const result = await getAllDictOptions();

		expect(result).toEqual({});
	});
});

describe("ensurePresetDicts", () => {
	beforeEach(() => vi.clearAllMocks());

	it("全部预置字典缺失时逐个创建并写入子项", async () => {
		mockDb.query.dict.findFirst.mockResolvedValue(undefined);
		mockDb.insert.mockReturnValue({
			values: vi.fn(() => ({
				returning: vi
					.fn()
					.mockResolvedValue([
						{ id: "d-1", slug: "user_status", name: "用户状态" },
					]),
			})),
		});
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn().mockResolvedValue([]),
				innerJoin: vi.fn(() => ({
					where: vi.fn().mockResolvedValue([]),
				})),
			})),
		});

		await ensurePresetDicts();

		expect(mockDb.query.dict.findFirst).toHaveBeenCalledTimes(2);
		expect(mockDb.insert).toHaveBeenCalled();
	});

	it("预置字典已存在时跳过创建", async () => {
		mockDb.query.dict.findFirst.mockResolvedValue({
			id: "d-1",
			slug: "user_status",
			name: "用户状态",
		});
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn().mockResolvedValue([]),
				innerJoin: vi.fn(() => ({
					where: vi.fn().mockResolvedValue([]),
				})),
			})),
		});

		await ensurePresetDicts();

		expect(mockDb.insert).not.toHaveBeenCalled();
	});
});
