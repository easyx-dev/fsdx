/**
 * 字典导入逻辑单元测试
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, txRows } = vi.hoisted(() => {
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

	const txUpdate = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) }));
	const txInsert = vi.fn(() => ({ values: vi.fn() }));

	const mockTx = {
		select: vi.fn(() => chain),
		update: txUpdate,
		insert: txInsert,
	};

	return {
		mockDb: {
			transaction: vi.fn((fn: (_tx: unknown) => unknown) => fn(mockTx)),
		},
		txRows: rows,
	};
});

vi.mock("#/db/index", () => ({ db: mockDb }));

import { importDicts } from "../-mods/dicts.server";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("importDicts", () => {
	it("导入新字典类型", async () => {
		// existingDicts 查询 + dict findFirst 均返回空
		txRows.mockReset().mockResolvedValue([]);

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
		// existingDicts 查询空，dict findFirst 命中
		txRows
			.mockReset()
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: "d-1", slug: "dict1" }])
			.mockResolvedValue([]);

		const result = await importDicts({
			dicts: [{ name: "更新后的字典", slug: "dict1" }],
			dictItems: [],
		});

		expect(result.dictsCreated).toBe(0);
		expect(result.dictsUpdated).toBe(1);
	});

	it("导入新字典条目", async () => {
		// existingDicts 空 → dict findFirst 命中 → dictItem findFirst 空
		txRows
			.mockReset()
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: "d-1", slug: "dict1" }])
			.mockResolvedValueOnce([])
			.mockResolvedValue([]);

		const result = await importDicts({
			dicts: [{ name: "字典1", slug: "dict1" }],
			dictItems: [{ dictSlug: "dict1", label: "条目1", value: "v1" }],
		});

		expect(result.dictsUpdated).toBe(1);
		expect(result.itemsCreated).toBe(1);
		expect(result.itemsUpdated).toBe(0);
	});

	it("更新已有字典条目", async () => {
		// existingDicts 空 → dict findFirst 命中 → dictItem findFirst 命中
		txRows
			.mockReset()
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: "d-1", slug: "dict1" }])
			.mockResolvedValueOnce([{ id: "di-1" }])
			.mockResolvedValue([]);

		const result = await importDicts({
			dicts: [{ name: "字典1", slug: "dict1" }],
			dictItems: [{ dictSlug: "dict1", label: "条目1", value: "v1" }],
		});

		expect(result.dictsUpdated).toBe(1);
		expect(result.itemsCreated).toBe(0);
		expect(result.itemsUpdated).toBe(1);
	});

	it("跳过未知 dictSlug 的条目", async () => {
		// existingDicts 空 → dict findFirst 空（创建），未知条目被跳过
		txRows
			.mockReset()
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValue([]);

		const result = await importDicts({
			dicts: [{ name: "字典A", slug: "a" }],
			dictItems: [{ dictSlug: "unknown", label: "孤立条目", value: "v1" }],
		});

		expect(result.dictsCreated).toBe(1);
		expect(result.itemsSkipped).toBe(1);
		expect(result.itemsCreated).toBe(0);
	});

	it("混合导入统计", async () => {
		// existingDicts 空 → dict1 空 → dict2 命中 → item1 空 → item2 命中
		txRows
			.mockReset()
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: "d-2", slug: "existing" }])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: "di-2" }])
			.mockResolvedValue([]);

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
