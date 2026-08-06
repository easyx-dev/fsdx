/**
 * 字典导入逻辑单元测试
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, txDictFindFirst, txDictItemFindFirst, txSelectWhere } =
	vi.hoisted(() => {
		const txDictFindFirst = vi.fn();
		const txDictItemFindFirst = vi.fn();
		const txSelectWhere = vi.fn();

		const queryMock = {
			dict: { findFirst: txDictFindFirst },
			dictItem: { findFirst: txDictItemFindFirst },
		};
		const txUpdate = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) }));
		const txInsert = vi.fn(() => ({ values: vi.fn() }));
		const txSelect = vi.fn(() => ({
			from: vi.fn(() => ({ where: txSelectWhere })),
		}));

		const mockTx = {
			query: queryMock,
			update: txUpdate,
			insert: txInsert,
			select: txSelect,
		};

		return {
			mockDb: {
				query: queryMock,
				transaction: vi.fn((fn: (_tx: unknown) => unknown) => fn(mockTx)),
			},
			txDictFindFirst,
			txDictItemFindFirst,
			txSelectWhere,
		};
	});

vi.mock("#/db/index", () => ({ db: mockDb }));

import { importDicts } from "../-mods/dicts.server";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("importDicts", () => {
	it("导入新字典类型", async () => {
		txSelectWhere.mockResolvedValue([]);
		txDictFindFirst.mockResolvedValue(undefined);

		const result = await importDicts({
			dicts: [{ name: "测试字典", slug: "new-dict" }],
			dictItems: [],
		});

		expect(result.dictsCreated).toBe(1);
		expect(result.dictsUpdated).toBe(0);
		expect(result.itemsCreated).toBe(0);
		expect(result.itemsUpdated).toBe(0);
		expect(result.itemsSkipped).toBe(0);
	});

	it("更新已有字典类型", async () => {
		txSelectWhere.mockResolvedValue([]);
		txDictFindFirst.mockResolvedValue({ id: "d-1", slug: "dict1" });

		const result = await importDicts({
			dicts: [{ name: "更新后的字典", slug: "dict1" }],
			dictItems: [],
		});

		expect(result.dictsCreated).toBe(0);
		expect(result.dictsUpdated).toBe(1);
	});

	it("导入新字典条目", async () => {
		txSelectWhere.mockResolvedValue([]);
		txDictFindFirst.mockResolvedValue({ id: "d-1", slug: "dict1" });
		txDictItemFindFirst.mockResolvedValue(undefined);

		const result = await importDicts({
			dicts: [{ name: "字典1", slug: "dict1" }],
			dictItems: [{ dictSlug: "dict1", label: "条目1", value: "v1" }],
		});

		expect(result.dictsUpdated).toBe(1);
		expect(result.itemsCreated).toBe(1);
		expect(result.itemsUpdated).toBe(0);
	});

	it("更新已有字典条目", async () => {
		txSelectWhere.mockResolvedValue([]);
		txDictFindFirst.mockResolvedValue({ id: "d-1", slug: "dict1" });
		txDictItemFindFirst.mockResolvedValue({ id: "di-1" });

		const result = await importDicts({
			dicts: [{ name: "字典1", slug: "dict1" }],
			dictItems: [{ dictSlug: "dict1", label: "条目1", value: "v1" }],
		});

		expect(result.dictsUpdated).toBe(1);
		expect(result.itemsCreated).toBe(0);
		expect(result.itemsUpdated).toBe(1);
	});

	it("跳过未知 dictSlug 的条目", async () => {
		txSelectWhere.mockResolvedValue([]);
		txDictFindFirst.mockResolvedValue(undefined);

		const result = await importDicts({
			dicts: [{ name: "字典A", slug: "a" }],
			dictItems: [{ dictSlug: "unknown", label: "孤立条目", value: "v1" }],
		});

		expect(result.dictsCreated).toBe(1);
		expect(result.itemsSkipped).toBe(1);
		expect(result.itemsCreated).toBe(0);
	});

	it("混合导入统计", async () => {
		txSelectWhere.mockResolvedValue([]);
		txDictFindFirst
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce({ id: "d-2", slug: "existing" });
		txDictItemFindFirst
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce({ id: "di-2" });

		const result = await importDicts({
			dicts: [
				{ name: "新字典", slug: "new" },
				{ name: "已存在字典", slug: "existing" },
			],
			dictItems: [
				{ dictSlug: "new", label: "新条目", value: "v1" },
				{ dictSlug: "existing", label: "已存在条目", value: "v2" },
				{ dictSlug: "unknown", label: "孤立条目", value: "v3" },
			],
		});

		expect(result.dictsCreated).toBe(1);
		expect(result.dictsUpdated).toBe(1);
		expect(result.itemsCreated).toBe(1);
		expect(result.itemsUpdated).toBe(1);
		expect(result.itemsSkipped).toBe(1);
	});
});
