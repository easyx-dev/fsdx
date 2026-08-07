/**
 * UI 翻译 Schema 验证测试
 */
import { describe, expect, it } from "vitest";
import { importUITranslationsSchema } from "../ui-translations.functions";
import {
	deleteSchema,
	formSchema,
	getListSchema,
} from "../ui-translations.schemas";

describe("getListSchema", () => {
	it("空参数应通过校验", () => {
		const result = getListSchema.safeParse({});
		expect(result.success).toBe(true);
	});

	it("传入 locale 筛选应通过校验", () => {
		const result = getListSchema.safeParse({ locale: "zh" });
		expect(result.success).toBe(true);
	});
});

describe("formSchema", () => {
	it("无 id 创建应通过校验", () => {
		const result = formSchema.safeParse({
			locale: "zh",
			key: "common.save",
			value: "保存",
		});
		expect(result.success).toBe(true);
	});

	it("带 id 编辑应通过校验", () => {
		const result = formSchema.safeParse({
			id: "uuid-1",
			locale: "zh",
			key: "common.save",
			value: "保存",
		});
		expect(result.success).toBe(true);
	});

	it("非法 locale 应校验失败", () => {
		const result = formSchema.safeParse({
			locale: "invalid-locale",
			key: "common.save",
			value: "保存",
		});
		expect(result.success).toBe(false);
	});

	it("key 为空应校验失败", () => {
		const result = formSchema.safeParse({
			locale: "zh",
			key: "",
			value: "保存",
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

describe("importUITranslationsSchema", () => {
	const base = {
		data: {
			translations: [{ locale: "en", key: "home.title", value: "Home" }],
		},
	};

	it("合法导入数据应通过校验", () => {
		expect(importUITranslationsSchema.safeParse(base).success).toBe(true);
	});

	it("缺少 data 字段应校验失败", () => {
		expect(importUITranslationsSchema.safeParse({}).success).toBe(false);
	});

	it("空 translations 数组应通过校验", () => {
		expect(
			importUITranslationsSchema.safeParse({ data: { translations: [] } })
				.success,
		).toBe(true);
	});

	it("value 为空应校验失败", () => {
		expect(
			importUITranslationsSchema.safeParse({
				data: { translations: [{ locale: "en", key: "k", value: "" }] },
			}).success,
		).toBe(false);
	});
});
