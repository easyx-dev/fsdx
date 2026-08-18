/**
 * 系统配置管理测试：CRUD + 缓存
 * configCache 为全量列表缓存，getConfig / getVisibleConfigRows 均从缓存读取
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("#/services/config/config.cache", () => ({
	configCache: mockConfigCache,
	configTranslationCache: mockConfigTranslationCache,
}));

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
	importConfigs,
	loadConfigCache,
	refreshConfigTranslationCache,
	updateConfig,
	upsertConfig,
} from "#/services/config/config.server";

describe("loadConfigCache", () => {
	it("从 DB 加载配置到缓存", async () => {
		mockRows.mockResolvedValue([
			{
				id: "c-1",
				key: "site_name",
				value: "FSDX",
				clientVisible: true,
			},
		]);
		await loadConfigCache();
		expect(mockConfigCache.set).toHaveBeenCalledWith("all", [
			{ id: "c-1", key: "site_name", value: "FSDX", clientVisible: true },
		]);
	});
});

// ═══════════════════════════════════════════════════════════════════
// ensurePresetConfigs
// ═══════════════════════════════════════════════════════════════════

describe("ensurePresetConfigs", () => {
	it("预设配置不存在时创建", async () => {
		vi.clearAllMocks();
		mockRows.mockResolvedValue([]);
		mockDb.insert.mockReturnValue({
			values: vi.fn(() => ({ returning: vi.fn() })),
		});
		await ensurePresetConfigs();
		expect(mockDb.insert).toHaveBeenCalled();
	});

	it("预设配置已存在且未删除时跳过", async () => {
		vi.clearAllMocks();
		mockRows.mockResolvedValue([
			{ id: "c-1", key: "site_name", value: "FSDX", deletedAt: null },
		]);
		mockDb.insert.mockReturnValue({
			values: vi.fn(() => ({ returning: vi.fn() })),
		});
		await ensurePresetConfigs();
		expect(mockDb.insert).not.toHaveBeenCalled();
		expect(mockDb.update).not.toHaveBeenCalled();
	});

	it("预设配置被软删除时恢复", async () => {
		vi.clearAllMocks();
		mockRows.mockResolvedValue([
			{ id: "c-1", key: "site_name", value: "old", deletedAt: new Date() },
		]);
		mockDb.update.mockReturnValue({
			set: vi.fn(() => ({ where: vi.fn() })),
		});
		await ensurePresetConfigs();
		expect(mockDb.update).toHaveBeenCalled();
		expect(mockDb.insert).not.toHaveBeenCalled();
	});
});
describe("getConfig", () => {
	it("从缓存获取配置值", async () => {
		mockConfigCache.set("all", [
			{ id: "c-1", key: "site_name", value: "FSDX", clientVisible: true },
		]);
		const value = await getConfig("site_name");
		expect(value).toBe("FSDX");
	});

	it("缓存中不存在时返回空字符串", async () => {
		const value = await getConfig("nonexistent_key");
		expect(value).toBe("");
	});
});

describe("getConfigList", () => {
	it("返回配置列表", async () => {
		const configRows = [{ id: "c-1", key: "site_name", value: "FSDX" }];
		mockRows.mockResolvedValue(configRows);
		const result = await getConfigList();
		expect(result).toHaveLength(1);
		expect(result[0].key).toBe("site_name");
	});

	it("无配置时返回空数组", async () => {
		mockRows.mockResolvedValue([]);
		const result = await getConfigList();
		expect(result).toEqual([]);
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
		mockRows.mockResolvedValue([
			{ id: "c-1", key: "new_key", value: "val", clientVisible: false },
		]);
		const result = await createConfig({ key: "new_key", value: "val" });
		expect(result.key).toBe("new_key");
		expect(mockConfigCache.set).toHaveBeenCalledWith("all", [
			{ id: "c-1", key: "new_key", value: "val", clientVisible: false },
		]);
	});
});

describe("deleteConfig", () => {
	it("删除配置并刷新缓存", async () => {
		// findFirst 返回存在记录，loadConfigCache 的 select 返回空列表
		mockRows
			.mockReset()
			.mockResolvedValueOnce([{ id: "c-1", key: "old_key" }])
			.mockResolvedValue([]);
		const result = await deleteConfig("c-1");
		expect(result).toBe(true);
		expect(mockConfigCache.set).toHaveBeenCalledWith("all", []);
	});
	it("不存在的配置返回 false", async () => {
		mockRows.mockReset().mockResolvedValue([]);
		const result = await deleteConfig("不存在");
		expect(result).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════════════
// getVisibleConfigRows
// ═══════════════════════════════════════════════════════════════════

describe("getVisibleConfigRows", () => {
	it("返回 clientVisible=true 的配置行", async () => {
		mockConfigCache.set("all", [
			{ id: "c-1", key: "site_name", value: "FSDX", clientVisible: true },
			{ id: "c-2", key: "other", value: "val", clientVisible: false },
		]);
		const rows = await getVisibleConfigRows();
		expect(rows).toHaveLength(1);
		expect(rows[0].key).toBe("site_name");
	});

	it("无 clientVisible 配置时返回空数组", async () => {
		mockConfigCache.set("all", [
			{ id: "c-1", key: "other", value: "val", clientVisible: false },
		]);
		const rows = await getVisibleConfigRows();
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
		mockConfigTranslationCache.set("en", { "c-1": "FSDX EN" });
		const result = await getConfigTranslations("en");
		expect(result).toEqual({ "c-1": "FSDX EN" });
	});

	it("缓存未命中时查询 DB 并写入缓存", async () => {
		mockConfigTranslationCache.get.mockReturnValueOnce(undefined);
		mockRows.mockResolvedValue([{ entityId: "c-1", value: "FSDX EN" }]);
		const result = await getConfigTranslations("en");
		expect(result).toEqual({ "c-1": "FSDX EN" });
		expect(mockConfigTranslationCache.set).toHaveBeenCalledWith("en", {
			"c-1": "FSDX EN",
		});
	});
});

describe("upsertConfig", () => {
	beforeEach(() => vi.clearAllMocks());

	it("key 已存在时更新配置并保留未传字段", async () => {
		// findFirst 返回存在记录，loadConfigCache 的 select 返回空列表
		mockRows
			.mockReset()
			.mockResolvedValueOnce([
				{
					id: "c-1",
					key: "site_name",
					value: "old",
					clientVisible: true,
					valueType: "input",
					groupName: "站点设置",
					description: "站点名称",
				},
			])
			.mockResolvedValue([]);
		const setMock = vi.fn((_data: unknown) => ({ where: vi.fn() }));
		mockDb.update.mockReturnValue({ set: setMock } as any);

		await upsertConfig("site_name", "新值");

		expect(mockDb.insert).not.toHaveBeenCalled();
		// 更新 payload：仅覆盖传入字段，其余保留原值
		const payload = setMock.mock.calls[0][0] as Record<string, unknown>;
		expect(payload.value).toBe("新值");
		expect(payload.clientVisible).toBe(true);
		expect(payload.valueType).toBe("input");
		expect(payload.groupName).toBe("站点设置");
	});

	it("key 不存在时插入新配置", async () => {
		mockRows.mockReset().mockResolvedValue([]);
		const valuesMock = vi.fn();
		mockDb.insert.mockReturnValue({ values: valuesMock });

		await upsertConfig("new_key", "val");

		expect(valuesMock).toHaveBeenCalled();
		expect(mockDb.update).not.toHaveBeenCalled();
	});
});

describe("updateConfig", () => {
	beforeEach(() => vi.clearAllMocks());

	it("更新存在的配置返回记录并刷新缓存", async () => {
		mockDb.update.mockReturnValue({
			set: vi.fn(() => ({
				where: vi.fn(() => ({
					returning: vi
						.fn()
						.mockResolvedValue([{ id: "c-1", key: "k", value: "new" }]),
				})),
			})),
		});
		mockRows.mockResolvedValue([]);

		const result = await updateConfig("c-1", { value: "new" });

		expect(result).not.toBeNull();
		expect(result!.value).toBe("new");
		expect(mockConfigCache.set).toHaveBeenCalled();
	});

	it("不存在的配置返回 null 且不刷新缓存", async () => {
		mockDb.update.mockReturnValue({
			set: vi.fn(() => ({
				where: vi.fn(() => ({
					returning: vi.fn().mockResolvedValue([]),
				})),
			})),
		});

		const result = await updateConfig("ghost", { value: "x" });

		expect(result).toBeNull();
		expect(mockDb.select).not.toHaveBeenCalled();
	});
});

describe("refreshConfigTranslationCache", () => {
	beforeEach(() => vi.clearAllMocks());

	it("指定语言时删除缓存并重新加载", async () => {
		mockConfigTranslationCache.get.mockReturnValueOnce(undefined);
		mockRows.mockResolvedValue([]);

		await refreshConfigTranslationCache("en");

		expect(mockConfigTranslationCache.delete).toHaveBeenCalledWith("en");
		expect(mockConfigTranslationCache.set).toHaveBeenCalled();
	});

	it("不指定语言时清空全部缓存", async () => {
		mockConfigTranslationCache.keys.mockReturnValue(["en", "zh"]);

		await refreshConfigTranslationCache();

		expect(mockConfigTranslationCache.delete).toHaveBeenCalledTimes(2);
		expect(mockDb.select).not.toHaveBeenCalled();
	});
});

describe("importConfigs", () => {
	beforeEach(() => vi.clearAllMocks());

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

		expect(mockConfigCache.set).toHaveBeenCalled();
	});

	it("混合导入统计", async () => {
		mockRows
			.mockReset()
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ id: "c-2" }])
			.mockResolvedValue([]);

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
