/**
 * AI Rich Editor 提示词能力测试：fragment-only 定位的默认 system 提示词
 */
import { describe, expect, it } from "vitest";
import { buildDefaultSystemPrompt } from "../prompts";

describe("buildDefaultSystemPrompt", () => {
	it("定位为富文本片段：只输出 body 内部片段", () => {
		const prompt = buildDefaultSystemPrompt();
		expect(prompt).toContain("富文本 HTML 片段生成助手");
		expect(prompt).toContain("另一种形态的富文本");
		expect(prompt).toContain("<body>");
		expect(prompt).toContain("```html");
	});

	it("不输出整页文档外壳（禁止 DOCTYPE/html/head/body）", () => {
		const prompt = buildDefaultSystemPrompt();
		expect(prompt).toContain(
			"禁止输出 <!DOCTYPE> / <html> / <head> / <body> 外壳",
		);
	});

	it("要求自包含样式与代码块包裹", () => {
		const prompt = buildDefaultSystemPrompt();
		expect(prompt).toContain("<style>");
		expect(prompt).toContain("```html");
	});
});
