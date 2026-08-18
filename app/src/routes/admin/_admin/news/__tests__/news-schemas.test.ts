/**
 * 新闻 Schema 验证测试
 */
import { describe, expect, it } from "vitest";
import {
	createNewsSchema,
	exportSchema,
	getNewsSchema,
	listSchema,
	newsImportSchema,
	statusSchema,
	updateNewsSchema,
} from "#/services/news/news.schemas";

describe("listSchema", () => {
	it("空参数通过", () => {
		expect(listSchema.safeParse({}).success).toBe(true);
	});
});

describe("getNewsSchema", () => {
	it("有效 id 通过", () => {
		expect(getNewsSchema.safeParse({ id: "n-1" }).success).toBe(true);
	});

	it("空 id 失败", () => {
		expect(getNewsSchema.safeParse({ id: "" }).success).toBe(false);
	});
});

describe("statusSchema", () => {
	it("合法状态变更通过（draft→published）", () => {
		expect(
			statusSchema.safeParse({ id: "n-1", status: "published" }).success,
		).toBe(true);
	});

	it("非法状态失败", () => {
		expect(
			statusSchema.safeParse({ id: "n-1", status: "unknown" }).success,
		).toBe(false);
	});
});

describe("createNewsSchema", () => {
	it("仅标题创建通过，status 默认为 draft，isPinned 默认为 false", () => {
		const result = createNewsSchema.safeParse({ title: "新闻标题" });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.status).toBe("draft");
			expect(result.data.isPinned).toBe(false);
		}
	});

	it("空标题失败", () => {
		expect(createNewsSchema.safeParse({ title: "" }).success).toBe(false);
	});

	it("非法 status 失败", () => {
		expect(
			createNewsSchema.safeParse({ title: "x", status: "archived" }).success,
		).toBe(false);
	});

	it("可选字段 publishedAt 和 sortOrder 通过", () => {
		const result = createNewsSchema.safeParse({
			title: "新闻标题",
			publishedAt: "2026-01-01T00:00:00.000Z",
			sortOrder: 10,
		});
		expect(result.success).toBe(true);
	});
});

describe("updateNewsSchema", () => {
	it("合法更新通过", () => {
		expect(
			updateNewsSchema.safeParse({
				id: "n-1",
				title: "更新标题",
				status: "published",
				isPinned: true,
				isRecommended: false,
			}).success,
		).toBe(true);
	});

	it("缺少必填字段失败（仅 id 不够，title 为必填）", () => {
		expect(updateNewsSchema.safeParse({ id: "n-1" }).success).toBe(false);
	});

	it("publishedAt 为 null 通过", () => {
		expect(
			updateNewsSchema.safeParse({
				id: "n-1",
				title: "更新标题",
				status: "published",
				isPinned: true,
				isRecommended: false,
				publishedAt: null,
			}).success,
		).toBe(true);
	});

	it("可选字段 publishedAt 和 sortOrder 通过", () => {
		expect(
			updateNewsSchema.safeParse({
				id: "n-1",
				title: "更新标题",
				status: "published",
				isPinned: true,
				isRecommended: false,
				publishedAt: "2026-01-01T00:00:00.000Z",
				sortOrder: 10,
			}).success,
		).toBe(true);
	});
});

describe("newsImportSchema", () => {
	it("合法数组通过", () => {
		expect(
			newsImportSchema.safeParse({
				news: [{ title: "新闻1" }, { title: "新闻2" }],
			}).success,
		).toBe(true);
	});

	it("空数组通过", () => {
		expect(newsImportSchema.safeParse({ news: [] }).success).toBe(true);
	});

	it("缺少必填 title 失败", () => {
		expect(newsImportSchema.safeParse({ news: [{}] }).success).toBe(false);
	});
});

describe("exportSchema", () => {
	it("csv 格式通过", () => {
		expect(exportSchema.safeParse({ format: "csv" }).success).toBe(true);
	});

	it("json 格式通过", () => {
		expect(exportSchema.safeParse({ format: "json" }).success).toBe(true);
	});

	it("非法格式失败", () => {
		expect(exportSchema.safeParse({ format: "xml" }).success).toBe(false);
	});
});
