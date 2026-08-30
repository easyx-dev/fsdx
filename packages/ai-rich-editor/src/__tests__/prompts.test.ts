/**
 * AI Rich Editor 提示词能力测试：按输出形态组装默认 system 提示词
 */
import { describe, expect, it } from "vitest";
import { buildDefaultSystemPrompt } from "../prompts";

describe("buildDefaultSystemPrompt", () => {
	it("fragment 模式要求仅输出 body 内部片段", () => {
		const prompt = buildDefaultSystemPrompt("fragment");
		expect(prompt).toContain("页面内容片段");
		expect(prompt).toContain("<body>");
		expect(prompt).toContain("```html");
	});

	it("document 模式要求完整文档外壳", () => {
		const prompt = buildDefaultSystemPrompt("document");
		expect(prompt).toContain("<!DOCTYPE html>");
	});

	it("两种模式均要求自包含样式与代码块包裹", () => {
		expect(buildDefaultSystemPrompt("fragment")).toContain("<style>");
		expect(buildDefaultSystemPrompt("document")).toContain("<style>");
	});
});
