/**
 * 新闻管理测试：CRUD + slug 生成 + 内容渲染
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#/lib/logger/logger", () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const { mockDb } = vi.hoisted(() => {
	const q = () => ({ findFirst: vi.fn(), findMany: vi.fn() });
	const selectObj = { from: vi.fn(() => ({ where: vi.fn() })) };
	return {
		mockDb: {
			query: {
				news: q(),
				adminUser: q(),
				clientUser: q(),
				role: q(),
				dict: q(),
				dictItem: q(),
				systemConfig: q(),
				file: q(),
				captchaCode: q(),
				todos: q(),
			},
			$count: vi.fn(),
			select: vi.fn(() => selectObj),
			insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) })),
			update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
			delete: vi.fn(() => ({ where: vi.fn() })),
		},
		selectObj,
	};
});
vi.mock("#/db", () => ({ db: mockDb }));

import {
	changeNewsStatus,
	createNews,
	deleteNews,
	getNewsById,
	getNewsBySlug,
	getNewsList,
} from "#/server/news";

const newsRecord = {
	id: "n-1",
	title: "测试新闻",
	slug: "test-news",
	status: "draft",
	content: "{}",
	summary: "",
	isPinned: false,
	publishedAt: null,
	createdAt: new Date(),
	updatedAt: new Date(),
	deletedAt: null,
	coverImageId: null,
	createdBy: null,
	updatedBy: null,
};

describe("getNewsList", () => {
	beforeEach(() => vi.clearAllMocks());

	it("返回分页的新闻列表", async () => {
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					orderBy: vi.fn(() => ({
						limit: vi.fn(() => ({
							offset: vi.fn().mockResolvedValue([newsRecord]),
						})),
					})),
				})),
			})),
		});
		mockDb.$count.mockResolvedValue(1);

		const result = await getNewsList();
		expect(result.records).toHaveLength(1);
		expect(result.total).toBe(1);
	});
	it("支持状态筛选和分页参数", async () => {
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					orderBy: vi.fn(() => ({
						limit: vi.fn(() => ({ offset: vi.fn().mockResolvedValue([]) })),
					})),
				})),
			})),
		});
		mockDb.$count.mockResolvedValue(0);
		const result = await getNewsList({
			status: "published",
			page: 2,
			pageSize: 10,
		});
		expect(result.total).toBe(0);
	});
});
describe("getNewsBySlug", () => {
	beforeEach(() => vi.clearAllMocks());
	it("仅返回已发布的新闻", async () => {
		mockDb.query.news.findFirst.mockResolvedValue({
			...newsRecord,
			status: "published",
			content: '{"type":"doc"}',
		});
		const result = await getNewsBySlug("test-news");
		expect(result).not.toBeNull();
		expect(result!.status).toBe("published");
		expect(result!.html).toBeDefined();
	});
	it("不存在的 slug 返回 null", async () => {
		mockDb.query.news.findFirst.mockResolvedValue(undefined);
		const result = await getNewsBySlug("不存在");
		expect(result).toBeNull();
	});
});
describe("getNewsById", () => {
	it("返回任意状态的新闻", async () => {
		mockDb.query.news.findFirst.mockResolvedValue(newsRecord);
		const result = await getNewsById("n-1");
		expect(result).not.toBeNull();
		expect(result!.id).toBe("n-1");
	});
});
describe("createNews", () => {
	it("创建新闻并返回记录", async () => {
		mockDb.query.news.findFirst.mockResolvedValue(undefined);
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
		mockDb.query.news.findFirst.mockResolvedValue(newsRecord);
		const result = await changeNewsStatus("n-1", "published");
		expect(result.success).toBe(true);
	});
});
describe("deleteNews", () => {
	it("软删除新闻", async () => {
		mockDb.query.news.findFirst.mockResolvedValue(newsRecord);
		const result = await deleteNews("n-1");
		expect(result).toBe(true);
	});
	it("不存在的新闻返回 false", async () => {
		mockDb.query.news.findFirst.mockResolvedValue(undefined);
		const result = await deleteNews("不存在");
		expect(result).toBe(false);
	});
});
describe("renderContent", () => {
	it("getNewsBySlug 返回 html 字段", async () => {
		mockDb.query.news.findFirst.mockResolvedValue({
			...newsRecord,
			status: "published",
			content:
				'{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello"}]}]}',
		});
		const result = await getNewsBySlug("slug");
		// 有效的 TipTap JSON 被渲染为 HTML
		expect(result!.html).toContain("<p>Hello</p>");
	});
});
