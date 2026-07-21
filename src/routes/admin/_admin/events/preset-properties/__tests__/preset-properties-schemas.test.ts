/**
 * 预设属性 Schema 验证测试
 */
import { describe, expect, it } from "vitest";
import {
	presetPropertyCreateSchema,
	presetPropertyDeleteSchema,
	presetPropertyUpdateSchema,
} from "../preset-properties.schemas";

describe("presetPropertyCreateSchema", () => {
	it("有效参数应通过校验", () => {
		const result = presetPropertyCreateSchema.safeParse({
			key: "page_url",
			label: "页面地址",
		});
		expect(result.success).toBe(true);
	});

	it("传入 dataType 应通过校验", () => {
		const result = presetPropertyCreateSchema.safeParse({
			key: "page_url",
			label: "页面地址",
			dataType: "string",
		});
		expect(result.success).toBe(true);
	});

	it("缺少 key 应校验失败", () => {
		const result = presetPropertyCreateSchema.safeParse({
			label: "页面地址",
		});
		expect(result.success).toBe(false);
	});
});

describe("presetPropertyUpdateSchema", () => {
	it("仅更新 label 应通过校验", () => {
		const result = presetPropertyUpdateSchema.safeParse({
			key: "page_url",
			label: "页面URL",
		});
		expect(result.success).toBe(true);
	});

	it("缺少 key 应校验失败", () => {
		const result = presetPropertyUpdateSchema.safeParse({
			label: "页面URL",
		});
		expect(result.success).toBe(false);
	});
});

describe("presetPropertyDeleteSchema", () => {
	it("有效参数应通过校验", () => {
		const result = presetPropertyDeleteSchema.safeParse({ key: "page_url" });
		expect(result.success).toBe(true);
	});

	it("key 为空应校验失败", () => {
		const result = presetPropertyDeleteSchema.safeParse({ key: "" });
		expect(result.success).toBe(false);
	});
});
