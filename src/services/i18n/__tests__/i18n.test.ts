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

vi.mock("#/lib/cache/cache", () => ({
	uiTranslationCache: mockCache,
}));

const { mockDb } = vi.hoisted(() => {
	const q = () => ({ findFirst: vi.fn(), findMany: vi.fn() });
	const selectObj = {
		from: vi.fn(() => ({
			where: vi.fn(() => ({
				orderBy: vi.fn(() => ({
					limit: vi.fn(() => ({ offset: vi.fn() })),
				})),
			})),
		})),
	};
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
			select: vi.fn(() => selectObj),
			insert: vi.fn(() => ({ values: vi.fn() })),
			update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
			delete: vi.fn(() => ({ where: vi.fn() })),
		},
	};
});
vi.mock("#/db", () => ({ db: mockDb }));

import {
	deleteContentTranslation,
	deleteUITranslation,
	getFieldTranslations,
	listContentTranslations,
	listUITranslations,
	upsertContentTranslation,
	upsertUITranslation,
} from "#/services/i18n/i18n.server";

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
