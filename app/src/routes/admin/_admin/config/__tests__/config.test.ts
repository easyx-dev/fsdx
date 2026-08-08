/**
 * 配置导入逻辑单元测试
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockRows, mockLoadConfigCache } = vi.hoisted(() => {
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
		mockDb: {
			select: vi.fn(() => chain),
			update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
			insert: vi.fn(() => ({ values: vi.fn() })),
		},
		mockRows: rows,
		mockLoadConfigCache: vi.fn(),
	};
});

vi.mock("#/db/index", () => ({ db: mockDb }));
vi.mock("#/services/config/config.server", () => ({
	loadConfigCache: mockLoadConfigCache,
}));

import { importConfigs } from "../-mods/config.server";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("importConfigs", () => {
	it("导入新配置", async () => {
		mockRows.mockResolvedValue([]);

		const result = await importConfigs({
			configs: [{ key: "new.key", value: "new-value" }],
		});

		expect(result.created).toBe(1);
		expect(result.updated).toBe(0);
	});

	it("更新已有配置", async () => {
		mockRows.mockResolvedValue([{ id: "c-1" }]);

		const result = await importConfigs({
			configs: [{ key: "existing.key", value: "updated-value" }],
		});

		expect(result.created).toBe(0);
		expect(result.updated).toBe(1);
	});

	it("导入后重新加载配置缓存", async () => {
		mockRows.mockResolvedValue([]);

		await importConfigs({
			configs: [{ key: "new.key", value: "new-value" }],
		});

		expect(mockLoadConfigCache).toHaveBeenCalled();
	});

	it("混合导入统计", async () => {
		mockRows
			.mockReset()
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: "c-2" }]);

		const result = await importConfigs({
			configs: [
				{ key: "new.key", value: "new-value" },
				{ key: "existing.key", value: "updated-value" },
			],
		});

		expect(result.created).toBe(1);
		expect(result.updated).toBe(1);
	});
});
