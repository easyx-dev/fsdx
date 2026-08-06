/**
 * 前台新闻 Schema 验证测试
 */
import { describe, expect, it } from "vitest";
import {
	newsSlugSchema,
	publishedNewsSchema,
} from "#/routes/news/-mods/news.functions";

describe("publishedNewsSchema（前台新闻列表分页）", () => {
	it("无参数使用默认值", () => {
		const result = publishedNewsSchema.safeParse({});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.page).toBe(1);
			expect(result.data.pageSize).toBe(12);
		}
	});

	it("pageSize 超过 50 失败", () => {
		expect(publishedNewsSchema.safeParse({ pageSize: 100 }).success).toBe(
			false,
		);
	});

	it("page 小于 1 失败", () => {
		expect(publishedNewsSchema.safeParse({ page: 0 }).success).toBe(false);
	});

	it("自定义分页通过", () => {
		const result = publishedNewsSchema.safeParse({ page: 2, pageSize: 6 });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.page).toBe(2);
			expect(result.data.pageSize).toBe(6);
		}
	});
});

describe("newsSlugSchema（前台新闻详情）", () => {
	it("有效 slug 通过", () => {
		expect(newsSlugSchema.safeParse({ slug: "hello-world" }).success).toBe(
			true,
		);
	});

	it("空 slug 失败", () => {
		expect(newsSlugSchema.safeParse({ slug: "" }).success).toBe(false);
	});
});
