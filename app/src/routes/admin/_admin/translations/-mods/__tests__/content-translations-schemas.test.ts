/**
 * 实体翻译 Schema 验证测试
 */
import { describe, expect, it } from "vitest";
import {
	deleteSchema,
	formSchema,
	getListSchema,
} from "../content-translations.schemas";

describe("getListSchema", () => {
	it("空参数应通过校验", () => {
		const result = getListSchema.safeParse({});
		expect(result.success).toBe(true);
	});

	it("所有参数同时传入应通过校验", () => {
		const result = getListSchema.safeParse({
			entityType: "news",
			locale: "zh",
			keyword: "标题",
			page: 1,
			sortField: "createdAt",
			sortOrder: "ascend",
		});
		expect(result.success).toBe(true);
	});
});

describe("formSchema", () => {
	it("有效参数应通过校验", () => {
		const result = formSchema.safeParse({
			entityType: "news",
			entityId: "news-1",
			fieldName: "title",
			locale: "zh",
			value: "新闻标题",
		});
		expect(result.success).toBe(true);
	});

	it("缺少 entityType 应校验失败", () => {
		const result = formSchema.safeParse({
			entityId: "news-1",
			fieldName: "title",
			locale: "zh",
			value: "新闻标题",
		});
		expect(result.success).toBe(false);
	});

	it("缺少 entityId 应校验失败", () => {
		const result = formSchema.safeParse({
			entityType: "news",
			fieldName: "title",
			locale: "zh",
			value: "新闻标题",
		});
		expect(result.success).toBe(false);
	});

	it("非法 locale 应校验失败", () => {
		const result = formSchema.safeParse({
			entityType: "news",
			entityId: "news-1",
			fieldName: "title",
			locale: "invalid-locale",
			value: "新闻标题",
		});
		expect(result.success).toBe(false);
	});
});

describe("deleteSchema", () => {
	it("有效参数应通过校验", () => {
		const result = deleteSchema.safeParse({ id: "uuid-1" });
		expect(result.success).toBe(true);
	});
});
