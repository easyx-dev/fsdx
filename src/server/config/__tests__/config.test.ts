/**
 * 系统配置管理测试：CRUD + 缓存
 * getConfig 已改为同步方法，直接从缓存读取
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("#/lib/logger/logger", () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const { mockConfigCache } = vi.hoisted(() => {
	const store = new Map<string, string>();
	return {
		mockConfigCache: {
			get: vi.fn((k: string) => store.get(k)),
			set: vi.fn((k: string, v: string) => {
				store.set(k, v);
			}),
			delete: vi.fn((k: string) => store.delete(k)),
			clear: vi.fn(() => store.clear()),
		},
	};
});
vi.mock("#/lib/cache/cache", () => ({ configCache: mockConfigCache }));

const { mockDb } = vi.hoisted(() => {
	const q = () => ({ findFirst: vi.fn(), findMany: vi.fn() });
	return {
		mockDb: {
			query: {
				systemConfig: q(),
				adminUser: q(),
				clientUser: q(),
				role: q(),
				news: q(),
				dict: q(),
				dictItem: q(),
				file: q(),
				captchaCode: q(),
				todos: q(),
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
	createConfig,
	deleteConfig,
	getConfig,
	getConfigList,
	loadConfigCache,
} from "#/server/config";

describe("loadConfigCache", () => {
	it("从 DB 加载配置到缓存", async () => {
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				where: vi
					.fn()
					.mockResolvedValue([{ key: "site_name", value: "FSDX CMS" }]),
			})),
		});
		await loadConfigCache();
		expect(mockConfigCache.clear).toHaveBeenCalled();
		expect(mockConfigCache.set).toHaveBeenCalledWith("site_name", "FSDX CMS");
	});
});

describe("getConfig", () => {
	it("从缓存同步获取配置值", () => {
		// 手动预填缓存
		mockConfigCache.set("site_name", "FSDX CMS");
		const value = getConfig("site_name");
		expect(value).toBe("FSDX CMS");
	});

	it("缓存中不存在时返回空字符串", () => {
		const value = getConfig("nonexistent_key");
		expect(value).toBe("");
	});
});

describe("getConfigList", () => {
	it("返回配置列表", async () => {
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn(() => ({ orderBy: vi.fn().mockResolvedValue([]) })),
			})),
		});
		const result = await getConfigList();
		expect(Array.isArray(result)).toBe(true);
	});
});

describe("createConfig", () => {
	it("创建配置并更新缓存", async () => {
		mockDb.insert.mockReturnValue({
			values: vi.fn(() => ({
				returning: vi
					.fn()
					.mockResolvedValue([{ id: "c-1", key: "new_key", value: "val" }]),
			})),
		});
		const result = await createConfig({ key: "new_key", value: "val" });
		expect(result.key).toBe("new_key");
		expect(mockConfigCache.set).toHaveBeenCalledWith("new_key", "val");
	});
});

describe("deleteConfig", () => {
	it("删除配置并移除缓存", async () => {
		mockDb.query.systemConfig.findFirst.mockResolvedValue({
			id: "c-1",
			key: "old_key",
		});
		const result = await deleteConfig("c-1");
		expect(result).toBe(true);
		expect(mockConfigCache.delete).toHaveBeenCalledWith("old_key");
	});
	it("不存在的配置返回 false", async () => {
		mockDb.query.systemConfig.findFirst.mockResolvedValue(undefined);
		const result = await deleteConfig("不存在");
		expect(result).toBe(false);
	});
});
