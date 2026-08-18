/**
 * 新闻管理测试：CRUD + slug 生成 + 内容渲染 + 翻译
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#/lib/logger/logger", () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const { mockGetContentTranslations } = vi.hoisted(() => {
	return {
		mockGetContentTranslations: vi.fn(),
	};
});

vi.mock("#/services/i18n/i18n.server", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("#/services/i18n/i18n.server")>();
	return {
		...actual,
		getContentTranslations: mockGetContentTranslations,
	};
});

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
	changeNewsStatus,
	createNews,
	deleteNews,
	ensureUniqueSlug,
	generateSlug,
	getNewsById,
	getNewsBySlug,
	getNewsList,
	translateNewsRecord,
	translateNewsRecords,
} from "#/services/news/news.server";

const newsRecord = {
	id: "n-1",
	title: "测试新闻",
	slug: "test-news",
	status: "draft",
	content: "{}",
	description: "",
	isPinned: false,
	isRecommended: false,
	sortOrder: 0,
	publishedAt: null,
	createdAt: new Date(),
	updatedAt: new Date(),
	deletedAt: null,
	coverImageId: null,
	externalUrl: null,
	createdById: null,
	updatedById: null,
};

describe("getNewsList", () => {
	beforeEach(() => vi.clearAllMocks());

	it("返回分页的新闻列表", async () => {
		mockRows.mockResolvedValue([newsRecord]);
		mockDb.$count.mockResolvedValue(1);

		const result = await getNewsList();
		expect(result.records).toHaveLength(1);
		expect(result.total).toBe(1);
	});
	it("支持状态筛选和分页参数", async () => {
		mockRows.mockResolvedValue([]);
		mockDb.$count.mockResolvedValue(0);
		const result = await getNewsList({
			status: "published",
			page: 2,
			pageSize: 10,
		});
		expect(result.total).toBe(0);
	});
	it("支持排序参数", async () => {
		mockRows.mockResolvedValue([newsRecord]);
		mockDb.$count.mockResolvedValue(1);
		const result = await getNewsList({
			sortField: "createdAt",
			sortOrder: "ascend",
		});
		expect(result.records).toHaveLength(1);
	});
});
describe("getNewsBySlug", () => {
	beforeEach(() => vi.clearAllMocks());
	it("仅返回已发布的新闻", async () => {
		mockRows.mockResolvedValue([
			{
				...newsRecord,
				status: "published",
				content: "<p>Hello</p>",
			},
		]);
		const result = await getNewsBySlug("test-news");
		expect(result).not.toBeNull();
		expect(result!.status).toBe("published");
		expect(result!.html).toBeDefined();
	});
	it("不存在的 slug 返回 null", async () => {
		mockRows.mockResolvedValue([]);
		const result = await getNewsBySlug("不存在");
		expect(result).toBeNull();
	});
});
describe("getNewsById", () => {
	it("返回任意状态的新闻", async () => {
		mockRows.mockResolvedValue([newsRecord]);
		const result = await getNewsById("n-1");
		expect(result).not.toBeNull();
		expect(result!.id).toBe("n-1");
	});
});
describe("createNews", () => {
	it("创建新闻并返回记录", async () => {
		mockRows.mockResolvedValue([]);
		mockDb.insert.mockReturnValue({
			values: vi.fn(() => ({
				returning: vi.fn().mockResolvedValue([{ ...newsRecord, id: "new-1" }]),
			})),
		});
		const result = await createNews({ title: "新新闻", status: "draft" });
		expect(result.id).toBe("new-1");
	});
});
describe("changeNewsStatus", () => {
	it("变更新闻状态", async () => {
		mockRows.mockResolvedValue([newsRecord]);
		const result = await changeNewsStatus("n-1", "published");
		expect(result.success).toBe(true);
	});
});
describe("deleteNews", () => {
	it("软删除新闻", async () => {
		mockRows.mockResolvedValue([newsRecord]);
		const result = await deleteNews("n-1");
		expect(result).toBe(true);
	});
	it("不存在的新闻返回 false", async () => {
		mockRows.mockResolvedValue([]);
		const result = await deleteNews("不存在");
		expect(result).toBe(false);
	});
});
describe("renderContent", () => {
	it("getNewsBySlug 返回 html 字段（wangEditor 直接存 HTML）", async () => {
		mockRows.mockResolvedValue([
			{
				...newsRecord,
				status: "published",
				content: "<p>Hello</p>",
			},
		]);
		const result = await getNewsBySlug("slug");
		expect(result!.html).toContain("<p>Hello</p>");
	});
});
describe("generateSlug", () => {
	it("中文标题使用时间戳后缀", () => {
		const slug = generateSlug("新闻标题");
		expect(slug).toMatch(/^news-\d{13}$/);
	});

	it("ASCII 标题转为 kebab-case", () => {
		expect(generateSlug("Hello World News")).toBe("hello-world-news");
	});

	it("去除非法字符并压缩连字符", () => {
		expect(generateSlug("  Foo!!  Bar??  ")).toBe("foo-bar");
	});

	it("超长标题截断到 100 字符", () => {
		const slug = generateSlug("a".repeat(150));
		expect(slug).toHaveLength(100);
	});

	it("全部为非法字符时回退为时间戳 slug", () => {
		expect(generateSlug("!!!")).toMatch(/^news-\d{13}$/);
	});
});

describe("createNews 分支", () => {
	beforeEach(() => vi.clearAllMocks());

	it("达到推荐上限时抛错", async () => {
		mockDb.$count.mockResolvedValue(5);

		await expect(
			createNews({ title: "新新闻", isRecommended: true }),
		).rejects.toThrow("最多推荐 5 条新闻");
	});

	it("slug 冲突时自动追加数字后缀", async () => {
		mockDb.$count.mockResolvedValue(0);
		mockRows
			.mockReset()
			.mockResolvedValueOnce([{ id: "n-x", slug: "test-news" }])
			.mockResolvedValueOnce([]);
		const valuesMock = vi.fn((_data: unknown) => ({
			returning: vi
				.fn()
				.mockResolvedValue([{ ...newsRecord, slug: "test-news-1" }]),
		}));
		mockDb.insert.mockReturnValue({ values: valuesMock } as any);

		await createNews({ title: "新新闻", slug: "test-news" });

		const values = valuesMock.mock.calls[0][0] as { slug: string };
		expect(values.slug).toBe("test-news-1");
	});

	it("发布状态且未传 publishedAt 时自动填充当前时间", async () => {
		mockRows.mockReset().mockResolvedValue([]);
		const valuesMock = vi.fn((_data: unknown) => ({
			returning: vi
				.fn()
				.mockResolvedValue([{ ...newsRecord, status: "published" }]),
		}));
		mockDb.insert.mockReturnValue({ values: valuesMock } as any);
		const before = Date.now();

		await createNews({ title: "新新闻", status: "published" });

		const values = valuesMock.mock.calls[0][0] as { publishedAt: Date | null };
		expect(values.publishedAt).toBeInstanceOf(Date);
		expect((values.publishedAt as Date).getTime()).toBeGreaterThanOrEqual(
			before - 1000,
		);
	});
});

describe("changeNewsStatus", () => {
	beforeEach(() => vi.clearAllMocks());

	it("首次发布时自动填充 publishedAt", async () => {
		mockRows.mockResolvedValue([{ ...newsRecord, publishedAt: null }]);
		const setMock = vi.fn((_data: unknown) => ({ where: vi.fn() }));
		mockDb.update.mockReturnValue({ set: setMock } as any);

		await changeNewsStatus("n-1", "published");

		const updateData = setMock.mock.calls[0][0] as { publishedAt?: Date };
		expect(updateData.publishedAt).toBeInstanceOf(Date);
	});

	it("已发布过的新闻不重复设置 publishedAt", async () => {
		mockRows.mockResolvedValue([{ ...newsRecord, publishedAt: new Date() }]);
		const setMock = vi.fn((_data: unknown) => ({ where: vi.fn() }));
		mockDb.update.mockReturnValue({ set: setMock } as any);

		await changeNewsStatus("n-1", "published");

		const updateData = setMock.mock.calls[0][0] as { publishedAt?: Date };
		expect(updateData.publishedAt).toBeUndefined();
	});

	it("非发布状态不查询现有记录", async () => {
		const setMock = vi.fn((_data: unknown) => ({ where: vi.fn() }));
		mockDb.update.mockReturnValue({ set: setMock } as any);

		await changeNewsStatus("n-1", "archived");

		expect(mockDb.select).not.toHaveBeenCalled();
		const updateData = setMock.mock.calls[0][0] as { status: string };
		expect(updateData.status).toBe("archived");
	});
});

describe("translateNewsRecord", () => {
	beforeEach(() => vi.clearAllMocks());

	it("默认语言返回原记录，不查询翻译", async () => {
		const result = await translateNewsRecord(newsRecord, "zh");
		expect(result).toEqual(newsRecord);
		expect(mockGetContentTranslations).not.toHaveBeenCalled();
	});

	it("非默认语言时查询并覆盖字段", async () => {
		mockGetContentTranslations.mockResolvedValue({
			title: { fieldName: "title", value: "Test News", valueType: "text" },
			description: {
				fieldName: "description",
				value: "English description",
				valueType: "text",
			},
		});

		const result = await translateNewsRecord(newsRecord, "en");
		expect(result.title).toBe("Test News");
		expect(result.description).toBe("English description");
		expect(mockGetContentTranslations).toHaveBeenCalledWith(
			"news",
			"n-1",
			"en",
		);
	});

	it("无翻译时返回原记录", async () => {
		mockGetContentTranslations.mockResolvedValue({});

		const result = await translateNewsRecord(newsRecord, "en");
		expect(result).toEqual(newsRecord);
	});
});
describe("translateNewsRecords", () => {
	beforeEach(() => vi.clearAllMocks());

	it("批量翻译多条记录", async () => {
		const records = [newsRecord, { ...newsRecord, id: "n-2" }];
		mockGetContentTranslations.mockResolvedValue({
			"n-1": {
				title: { fieldName: "title", value: "Translated", valueType: "text" },
			},
			"n-2": {
				title: { fieldName: "title", value: "Translated", valueType: "text" },
			},
		});

		const results = await translateNewsRecords(records, "en");
		expect(results).toHaveLength(2);
		expect(results[0].title).toBe("Translated");
		expect(results[1].title).toBe("Translated");
		expect(mockGetContentTranslations).toHaveBeenCalledTimes(1);
		expect(mockGetContentTranslations).toHaveBeenCalledWith(
			"news",
			["n-1", "n-2"],
			"en",
		);
	});

	it("默认语言直接返回，不查询翻译", async () => {
		const records = [newsRecord, { ...newsRecord, id: "n-2" }];
		const results = await translateNewsRecords(records, "zh");
		expect(results).toEqual(records);
		expect(mockGetContentTranslations).not.toHaveBeenCalled();
	});
});

describe("ensureUniqueSlug", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("slug 唯一时直接返回", async () => {
		mockRows.mockResolvedValue([]);

		const result = await ensureUniqueSlug("my-slug");

		expect(result).toBe("my-slug");
	});

	it("slug 冲突时追加后缀", async () => {
		mockRows
			.mockReset()
			.mockResolvedValueOnce([{ id: "n-1" }])
			.mockResolvedValueOnce([]);

		const result = await ensureUniqueSlug("my-slug");

		expect(result).toBe("my-slug-1");
		expect(mockDb.select).toHaveBeenCalledTimes(2);
	});

	it("排除自身 id 时判断唯一", async () => {
		mockRows.mockReset().mockResolvedValue([]);

		const result = await ensureUniqueSlug("my-slug", "n-1");

		expect(result).toBe("my-slug");
	});

	it("超过 100 次冲突抛出错误", async () => {
		mockRows.mockReset().mockResolvedValue([{ id: "n-1" }]);

		await expect(ensureUniqueSlug("my-slug")).rejects.toThrow(
			'无法为 slug "my-slug" 生成唯一标识',
		);
	});
});
