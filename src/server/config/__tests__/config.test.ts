/**
 * 系统配置管理测试：CRUD + 缓存
 * configCache 为全量列表缓存，getConfig / getVisibleConfigRows 均从缓存读取
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("#/lib/logger/logger", () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const { mockConfigCache } = vi.hoisted(() => {
	interface CachedConfig {
		id: string;
		key: string;
		value: string;
		clientVisible: boolean;
	}
	const store = new Map<string, CachedConfig[]>();
	return {
		mockConfigCache: {
			get: vi.fn((k: string) => store.get(k)),
			set: vi.fn((k: string, v: CachedConfig[]) => {
				store.set(k, v);
			}),
			delete: vi.fn((k: string) => store.delete(k)),
			clear: vi.fn(() => store.clear()),
		},
	};
});

const { mockConfigTranslationCache } = vi.hoisted(() => {
	const translationStore = new Map<string, Record<string, string>>();
	return {
		mockConfigTranslationCache: {
			get: vi.fn((k: string) => translationStore.get(k)),
			set: vi.fn((k: string, v: Record<string, string>) => {
				translationStore.set(k, v);
			}),
			delete: vi.fn((k: string) => translationStore.delete(k)),
			clear: vi.fn(() => translationStore.clear()),
			keys: vi.fn(() => Array.from(translationStore.keys())),
		},
	};
});

vi.mock("#/lib/cache/cache", () => ({
	configCache: mockConfigCache,
	configTranslationCache: mockConfigTranslationCache,
}));

const { mockDb } = vi.hoisted(() => {
	const q = () => ({ findFirst: vi.fn(), findMany: vi.fn() });
	return {
		mockDb: {
			query: {
				systemConfig: q(),
				contentTranslation: q(),
				adminUser: q(),
				clientUser: q(),
				role: q(),
				news: q(),
				dict: q(),
				dictItem: q(),
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
	createConfig,
	deleteConfig,
	ensurePresetConfigs,
	getConfig,
	getConfigList,
	getConfigTranslations,
	getVisibleConfigRows,
	loadConfigCache,
} from "#/server/config/config.server";

describe("loadConfigCache", () => {
	it("从 DB 加载配置到缓存", async () => {
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn().mockResolvedValue([
					{
						id: "c-1",
						key: "site_name",
						value: "FSDX CMS",
						clientVisible: true,
					},
				]),
			})),
		});
		await loadConfigCache();
		expect(mockConfigCache.set).toHaveBeenCalledWith("all", [
			{ id: "c-1", key: "site_name", value: "FSDX CMS", clientVisible: true },
		]);
	});
});

// ═══════════════════════════════════════════════════════════════════
// ensurePresetConfigs
// ═══════════════════════════════════════════════════════════════════

describe("ensurePresetConfigs", () => {
	it("预设配置不存在时创建", async () => {
		vi.clearAllMocks();
		mockDb.query.systemConfig.findFirst.mockResolvedValue(undefined);
		mockDb.insert.mockReturnValue({
			values: vi.fn(() => ({ returning: vi.fn() })),
		});
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn().mockResolvedValue([]),
			})),
		});
		await ensurePresetConfigs();
		expect(mockDb.insert).toHaveBeenCalled();
	});

	it("预设配置已存在且未删除时跳过", async () => {
		vi.clearAllMocks();
		mockDb.query.systemConfig.findFirst.mockResolvedValue({
			id: "c-1",
			key: "site_name",
			value: "FSDX CMS",
			deletedAt: null,
		});
		mockDb.insert.mockReturnValue({
			values: vi.fn(() => ({ returning: vi.fn() })),
		});
		await ensurePresetConfigs();
		expect(mockDb.insert).not.toHaveBeenCalled();
		expect(mockDb.update).not.toHaveBeenCalled();
	});

	it("预设配置被软删除时恢复", async () => {
		vi.clearAllMocks();
		mockDb.query.systemConfig.findFirst.mockResolvedValue({
			id: "c-1",
			key: "site_name",
			value: "old",
			deletedAt: new Date(),
		});
		mockDb.update.mockReturnValue({
			set: vi.fn(() => ({ where: vi.fn() })),
		});
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn().mockResolvedValue([]),
			})),
		});
		await ensurePresetConfigs();
		expect(mockDb.update).toHaveBeenCalled();
		expect(mockDb.insert).not.toHaveBeenCalled();
	});
});
describe("getConfig", () => {
	it("从缓存同步获取配置值", () => {
		mockConfigCache.set("all", [
			{ id: "c-1", key: "site_name", value: "FSDX CMS", clientVisible: true },
		]);
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
		// mock insert
		mockDb.insert.mockReturnValue({
			values: vi.fn(() => ({
				returning: vi
					.fn()
					.mockResolvedValue([{ id: "c-1", key: "new_key", value: "val" }]),
			})),
		});
		// mock loadConfigCache 的 select
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				where: vi
					.fn()
					.mockResolvedValue([
						{ id: "c-1", key: "new_key", value: "val", clientVisible: false },
					]),
			})),
		});
		const result = await createConfig({ key: "new_key", value: "val" });
		expect(result.key).toBe("new_key");
		expect(mockConfigCache.set).toHaveBeenCalledWith("all", [
			{ id: "c-1", key: "new_key", value: "val", clientVisible: false },
		]);
	});
});

describe("deleteConfig", () => {
	it("删除配置并刷新缓存", async () => {
		mockDb.query.systemConfig.findFirst.mockResolvedValue({
			id: "c-1",
			key: "old_key",
		});
		// mock loadConfigCache 的 select
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn().mockResolvedValue([]),
			})),
		});
		const result = await deleteConfig("c-1");
		expect(result).toBe(true);
		expect(mockConfigCache.set).toHaveBeenCalledWith("all", []);
	});
	it("不存在的配置返回 false", async () => {
		mockDb.query.systemConfig.findFirst.mockResolvedValue(undefined);
		const result = await deleteConfig("不存在");
		expect(result).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════════════
// getVisibleConfigRows
// ═══════════════════════════════════════════════════════════════════

describe("getVisibleConfigRows", () => {
	it("返回 clientVisible=true 的配置行", () => {
		mockConfigCache.set("all", [
			{ id: "c-1", key: "site_name", value: "FSDX CMS", clientVisible: true },
			{ id: "c-2", key: "other", value: "val", clientVisible: false },
		]);
		const rows = getVisibleConfigRows();
		expect(rows).toHaveLength(1);
		expect(rows[0].key).toBe("site_name");
	});

	it("无 clientVisible 配置时返回空数组", () => {
		mockConfigCache.set("all", [
			{ id: "c-1", key: "other", value: "val", clientVisible: false },
		]);
		const rows = getVisibleConfigRows();
		expect(rows).toHaveLength(0);
	});
});

// ═══════════════════════════════════════════════════════════════════
// getConfigTranslations
// ═══════════════════════════════════════════════════════════════════

describe("getConfigTranslations", () => {
	it("默认语言返回空对象", async () => {
		const result = await getConfigTranslations("zh");
		expect(result).toEqual({});
	});

	it("缓存命中直接返回", async () => {
		mockConfigTranslationCache.set("en", { "c-1": "FSDX CMS EN" });
		const result = await getConfigTranslations("en");
		expect(result).toEqual({ "c-1": "FSDX CMS EN" });
	});

	it("缓存未命中时查询 DB 并写入缓存", async () => {
		mockConfigTranslationCache.get.mockReturnValueOnce(undefined);
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				where: vi
					.fn()
					.mockResolvedValue([{ entityId: "c-1", value: "FSDX CMS EN" }]),
			})),
		});
		const result = await getConfigTranslations("en");
		expect(result).toEqual({ "c-1": "FSDX CMS EN" });
		expect(mockConfigTranslationCache.set).toHaveBeenCalledWith("en", {
			"c-1": "FSDX CMS EN",
		});
	});
});
