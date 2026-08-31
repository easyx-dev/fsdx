/**
 * AI Rich Editor 纯函数测试：代码块提取与预览文档构建
 */
import { describe, expect, it } from "vitest";
import { buildPreviewDocument, extractHtmlFragments } from "../utils/extract";

describe("extractHtmlFragments", () => {
	it("提取带语言标识的 ```html 代码块", () => {
		const content = "说明文字\n```html\n<div>hello</div>\n```\n结尾";
		expect(extractHtmlFragments(content)).toEqual(["<div>hello</div>"]);
	});

	it("提取无语言标识的 ``` 代码块", () => {
		const content = "```\n<p>plain</p>\n```";
		expect(extractHtmlFragments(content)).toEqual(["<p>plain</p>"]);
	});

	it("提取多个代码块并去除重复", () => {
		const content =
			"```html\n<div>a</div>\n```\n```html\n<div>b</div>\n```\n```html\n<div>a</div>\n```";
		expect(extractHtmlFragments(content)).toEqual([
			"<div>a</div>",
			"<div>b</div>",
		]);
	});

	it("无代码块但整体以 < 开头时兜底整体返回", () => {
		expect(extractHtmlFragments("<section>solo</section>")).toEqual([
			"<section>solo</section>",
		]);
	});

	it("空代码块与空内容返回空数组", () => {
		expect(extractHtmlFragments("```html\n\n```")).toEqual([]);
		expect(extractHtmlFragments("只是普通文字")).toEqual([]);
		expect(extractHtmlFragments("")).toEqual([]);
	});

	it("去首尾空白", () => {
		const content = "```html\n  <div>  hi  </div>  \n```";
		expect(extractHtmlFragments(content)).toEqual(["<div>  hi  </div>"]);
	});
});

describe("buildPreviewDocument", () => {
	it("片段模式包裹最小文档外壳", () => {
		const doc = buildPreviewDocument("<div>内容</div>");
		expect(doc).toContain("<!DOCTYPE html>");
		expect(doc).toContain('<meta charset="utf-8">');
		expect(doc).toContain("<body><div>内容</div></body>");
	});

	it("注入 previewHead 到 head（位于 body 之前）", () => {
		const doc = buildPreviewDocument(
			"<div>内容</div>",
			"<style>body{margin:0}</style>",
		);
		expect(doc).toContain('<meta name="viewport"');
		expect(doc).toContain("<style>body{margin:0}</style>");
		expect(doc.indexOf("<style>body{margin:0}</style>")).toBeLessThan(
			doc.indexOf("</head>"),
		);
		expect(doc).toContain("<body><div>内容</div></body>");
	});

	it("空 previewHead 不注入", () => {
		const doc = buildPreviewDocument("<div>内容</div>", "   ");
		expect(doc).not.toContain("<style>");
		expect(doc).toContain("</head><body><div>内容</div></body></html>");
	});
});
