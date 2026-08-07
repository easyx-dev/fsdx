/**
 * 国际化 CRUD 测试：UI 翻译 / 实体翻译维护
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#/lib/logger/logger", () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const { mockCache } = vi.hoisted(() => {
	const cacheStore = new Map<string, Record<string, string>>();
	return {
		mockCache: {
			get: vi.fn((locale: string) => cacheStore.get(locale)),
			set: vi.fn((locale: string, data: Record<string, string>) =>
				cacheStore.set(locale, data),
			),
			delete: vi.fn((locale: string) => {
				cacheStore.delete(locale);
				return true;
			}),
			keys: vi.fn(() => Array.from(cacheStore.keys())),
		},
	};
});

vi.mock("#/services/i18n/ui-translation.cache", () => ({
	uiTranslationCache: mockCache,
}));

const { mockDb } = vi.hoisted(() => {
	const q = () => ({ findFirst: vi.fn(), findMany: vi.fn() });
	return {
		mockDb: {
			query: {
				uiTranslation: q(),
				contentTranslation: q(),
				adminUser: q(),
				clientUser: q(),
				role: q(),
				dict: q(),
				dictItem: q(),
				systemConfig: q(),
				file: q(),
				captchaCode: q(),
				news: q(),
			},
			$count: vi.fn(),
			select: vi.fn(() => ({})) as any,
			insert: vi.fn(() => ({ values: vi.fn() })),
			update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
			delete: vi.fn(() => ({ where: vi.fn() })),
			transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
				cb(mockDb),
			),
		},
	};
});
vi.mock("#/db", () => ({ db: mockDb }));

import {
	deleteContentTranslation,
	deleteUITranslation,
	getAllContentTranslationsForExport,
	getAllUITranslationsForExport,
	getFieldTranslations,
	getUITranslations,
	importContentTranslations,
	importUiTranslations,
	listContentTranslations,
	listUITranslations,
	loadUITranslations,
	refreshUITranslationCache,
	upsertContentTranslation,
	upsertUITranslation,
} from "#/services/i18n/i18n.server";

beforeEach(() => vi.clearAllMocks());

const uiRecord = {
	id: "u-1",
	locale: "en",
	key: "home.title",
	value: "Welcome",
	valueType: "input",
	createdAt: new Date(),
	updatedAt: new Date(),
};
const ctRecord = {
	id: "ct-1",
	entityType: "news",
	entityId: "n-1",
	fieldName: "title",
	locale: "en",
	value: "Hello World",
	valueType: "text",
	createdAt: new Date(),
	updatedAt: new Date(),
};

describe("listUITranslations", () => {
	beforeEach(() => vi.clearAllMocks());
	it("无筛选条件返回分页列表", async () => {
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					orderBy: vi.fn(() => ({
						limit: vi.fn(() => ({
							offset: vi.fn().mockResolvedValue([uiRecord]),
						})),
					})),
				})),
			})),
		});
		mockDb.$count.mockResolvedValue(1);
		const result = await listUITranslations();
		expect(result.records).toHaveLength(1);
		expect(result.total).toBe(1);
	});
});

describe("upsertUITranslation", () => {
	beforeEach(() => vi.clearAllMocks());
	it("新建 UI 翻译", async () => {
		mockDb.query.uiTranslation.findFirst.mockResolvedValue(undefined);
		// setup mockDb.select for refreshUITranslationCache -> loadUITranslations
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
		});
		mockCache.keys.mockReturnValue([]);
		const result = await upsertUITranslation({
			locale: "en",
			key: "test.key",
			value: "Value",
		});
		expect(result.success).toBe(true);
		expect(mockDb.insert).toHaveBeenCalled();
		expect(mockDb.update).not.toHaveBeenCalled();
	});
	it("更新已有 UI 翻译", async () => {
		mockDb.query.uiTranslation.findFirst.mockResolvedValue(uiRecord);
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([uiRecord]) })),
		});
		const result = await upsertUITranslation({
			id: "u-1",
			locale: "en",
			key: "home.title",
			value: "Updated",
		});
		expect(result.success).toBe(true);
		expect(mockDb.update).toHaveBeenCalled();
		expect(mockDb.insert).not.toHaveBeenCalled();
	});
});

describe("deleteUITranslation", () => {
	beforeEach(() => vi.clearAllMocks());
	it("删除存在的翻译", async () => {
		mockDb.query.uiTranslation.findFirst.mockResolvedValue(uiRecord);
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([uiRecord]) })),
		});
		mockCache.keys.mockReturnValue([]);
		const result = await deleteUITranslation("u-1");
		expect(result).toBe(true);
	});
	it("不存在的翻译返回 false", async () => {
		mockDb.query.uiTranslation.findFirst.mockResolvedValue(undefined);
		const result = await deleteUITranslation("不存在");
		expect(result).toBe(false);
	});
});

describe("listContentTranslations", () => {
	beforeEach(() => vi.clearAllMocks());
	it("按 entityType 筛选", async () => {
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					orderBy: vi.fn(() => ({
						limit: vi.fn(() => ({
							offset: vi.fn().mockResolvedValue([ctRecord]),
						})),
					})),
				})),
			})),
		});
		mockDb.$count.mockResolvedValue(1);
		const result = await listContentTranslations({ entityType: "news" });
		expect(result.records).toHaveLength(1);
	});
});

describe("upsertContentTranslation", () => {
	beforeEach(() => vi.clearAllMocks());
	it("新建实体翻译", async () => {
		mockDb.query.contentTranslation.findFirst.mockResolvedValue(undefined);
		const result = await upsertContentTranslation({
			entityType: "news",
			entityId: "n-1",
			fieldName: "title",
			locale: "en",
			value: "Hello",
		});
		expect(result.success).toBe(true);
		expect(mockDb.insert).toHaveBeenCalled();
		expect(mockDb.update).not.toHaveBeenCalled();
	});
	it("更新已有实体翻译", async () => {
		mockDb.query.contentTranslation.findFirst.mockResolvedValue(ctRecord);
		const result = await upsertContentTranslation({
			id: "ct-1",
			entityType: "news",
			entityId: "n-1",
			fieldName: "title",
			locale: "en",
			value: "Updated",
		});
		expect(result.success).toBe(true);
		expect(mockDb.update).toHaveBeenCalled();
		expect(mockDb.insert).not.toHaveBeenCalled();
	});
});

describe("deleteContentTranslation", () => {
	it("删除存在的翻译", async () => {
		mockDb.query.contentTranslation.findFirst.mockResolvedValue(ctRecord);
		const result = await deleteContentTranslation("ct-1");
		expect(result).toBe(true);
	});
});

describe("getFieldTranslations", () => {
	it("查询某字段的所有语言翻译", async () => {
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([ctRecord]) })),
		});
		const result = await getFieldTranslations("news", "n-1", "title");
		expect(result).toHaveProperty("en");
		expect(result.en.value).toBe("Hello World");
	});
});

describe("loadUITranslations", () => {
	it("从数据库加载指定语言并组装为键值映射", async () => {
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				where: vi
					.fn()
					.mockResolvedValue([
						uiRecord,
						{ ...uiRecord, id: "u-2", key: "home.sub", value: "Sub" },
					]),
			})),
		});

		const result = await loadUITranslations("en");

		expect(result).toEqual({ "home.title": "Welcome", "home.sub": "Sub" });
	});

	it("无翻译时返回空对象", async () => {
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
		});

		const result = await loadUITranslations("zh");
		expect(result).toEqual({});
	});
});

describe("getUITranslations", () => {
	it("缓存命中时直接返回", async () => {
		mockCache.get.mockReturnValue({ "home.title": "Welcome" });

		const result = await getUITranslations("en");

		expect(result).toEqual({ "home.title": "Welcome" });
		expect(mockDb.select).not.toHaveBeenCalled();
	});

	it("缓存未命中时加载并写入缓存", async () => {
		mockCache.get.mockReturnValue(undefined);
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([uiRecord]) })),
		});

		const result = await getUITranslations("en");

		expect(result).toEqual({ "home.title": "Welcome" });
		expect(mockCache.set).toHaveBeenCalledWith("en", {
			"home.title": "Welcome",
		});
	});
});

describe("refreshUITranslationCache", () => {
	it("指定语言时删除该语言缓存并重新加载", async () => {
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([uiRecord]) })),
		});

		await refreshUITranslationCache("en");

		expect(mockCache.delete).toHaveBeenCalledWith("en");
		expect(mockCache.set).toHaveBeenCalled();
	});

	it("不指定语言时清空全部缓存", async () => {
		mockCache.keys.mockReturnValue(["en", "zh"]);

		await refreshUITranslationCache();

		expect(mockCache.delete).toHaveBeenCalledTimes(2);
		expect(mockDb.select).not.toHaveBeenCalled();
	});
});

describe("getAllUITranslationsForExport", () => {
	it("返回排序后的全部 UI 翻译", async () => {
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				orderBy: vi.fn(() => Promise.resolve([uiRecord])),
			})),
		});

		const result = await getAllUITranslationsForExport();

		expect(result).toEqual([
			{ locale: "en", key: "home.title", value: "Welcome", valueType: "input" },
		]);
	});
});

describe("importUiTranslations", () => {
	beforeEach(() => vi.clearAllMocks());

	it("逐个 upsert 并统计创建与更新数量", async () => {
		mockDb.query.uiTranslation.findFirst
			.mockResolvedValueOnce(uiRecord)
			.mockResolvedValueOnce(undefined);
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
		});

		const result = await importUiTranslations({
			translations: [
				{ locale: "en", key: "home.title", value: "New", valueType: "input" },
				{ locale: "zh", key: "new.key", value: "新", valueType: "input" },
			],
		});

		expect(result).toEqual({ created: 1, updated: 1 });
	});

	it("非法的 valueType 回退到 input", async () => {
		mockDb.query.uiTranslation.findFirst.mockResolvedValue(undefined);
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
		});
		const valuesMock = vi.fn();
		mockDb.insert.mockReturnValue({ values: valuesMock });

		await importUiTranslations({
			translations: [
				{ locale: "en", key: "k", value: "v", valueType: "bad-type" },
			],
		});

		expect(valuesMock.mock.calls[0][0].valueType).toBe("input");
	});
});

describe("getAllContentTranslationsForExport", () => {
	it("返回排序后的全部实体翻译", async () => {
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				orderBy: vi.fn(() => Promise.resolve([ctRecord])),
			})),
		});

		const result = await getAllContentTranslationsForExport();

		expect(result).toEqual([
			{
				entityType: "news",
				entityId: "n-1",
				fieldName: "title",
				locale: "en",
				value: "Hello World",
				valueType: "text",
			},
		]);
	});
});

describe("importContentTranslations", () => {
	beforeEach(() => vi.clearAllMocks());

	it("在事务中逐个 upsert 并统计数量", async () => {
		mockDb.query.contentTranslation.findFirst
			.mockResolvedValueOnce(ctRecord)
			.mockResolvedValueOnce(undefined);

		const result = await importContentTranslations({
			translations: [
				{
					entityType: "news",
					entityId: "n-1",
					fieldName: "title",
					locale: "en",
					value: "Updated",
					valueType: "text",
				},
				{
					entityType: "news",
					entityId: "n-2",
					fieldName: "title",
					locale: "zh",
					value: "标题",
					valueType: "text",
				},
			],
		});

		expect(result).toEqual({ created: 1, updated: 1 });
		expect(mockDb.transaction).toHaveBeenCalledTimes(1);
	});

	it("非法的 valueType 回退到 text", async () => {
		mockDb.query.contentTranslation.findFirst.mockResolvedValue(undefined);
		const valuesMock = vi.fn();
		mockDb.insert.mockReturnValue({ values: valuesMock });

		await importContentTranslations({
			translations: [
				{
					entityType: "news",
					entityId: "n-1",
					fieldName: "title",
					locale: "en",
					value: "x",
					valueType: "bad-type",
				},
			],
		});

		expect(valuesMock.mock.calls[0][0].valueType).toBe("text");
	});
});
