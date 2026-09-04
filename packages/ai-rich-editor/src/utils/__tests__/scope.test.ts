/**
 * AI 富文本样式作用域化纯函数测试：前缀生成 / CSS 选择器改写 / style 注入与整段包装
 */
import { describe, expect, it } from "vitest";
import {
	generateScopePrefix,
	prefixCss,
	scopeCssOfHtml,
	scopedRichContent,
} from "../scope";

const P = "rich-content-x";

describe("generateScopePrefix", () => {
	it("缺省生成以 rich-content- 开头的随机前缀", () => {
		expect(generateScopePrefix()).toMatch(/^rich-content-[a-z0-9]{4,}$/i);
	});

	it("传 scopeId 时生成稳定前缀", () => {
		expect(generateScopePrefix("news-a")).toBe("rich-content-news-a");
	});

	it("scopeId 会过滤非法 class 字符", () => {
		expect(generateScopePrefix("news/page!")).toBe("rich-content-newspage");
	});
});

describe("prefixCss", () => {
	it("给简单类选择器加前缀", () => {
		expect(prefixCss(".hero { color: red; }", P)).toBe(
			`.${P} .hero{ color: red; }`,
		);
	});

	it("给后代选择器加前缀", () => {
		expect(prefixCss(".hero h2 { margin: 0; }", P)).toBe(
			`.${P} .hero h2{ margin: 0; }`,
		);
	});

	it("给多选择器（逗号分隔）逐个加前缀", () => {
		expect(prefixCss("h1, .a > h2 { color: red }", P)).toBe(
			`.${P} h1, .${P} .a > h2{ color: red }`,
		);
	});

	it("@media/@supports 内嵌套规则递归加前缀", () => {
		expect(
			prefixCss("@media(max-width:600px){.a{color:red}.b{color:blue}}", P),
		).toBe(`@media(max-width:600px){.${P} .a{color:red}.${P} .b{color:blue}}`);
	});

	it("@keyframes 内容原样保留（帧选择器不参与前缀）", () => {
		const css = "@keyframes spin{from{opacity:0}to{opacity:1}}";
		expect(prefixCss(css, P)).toBe(css);
	});

	it("@font-face 内容原样保留", () => {
		const css = "@font-face{font-family:x;src:url(x.woff2)}";
		expect(prefixCss(css, P)).toBe(css);
	});

	it("body/*/:root 等全局选择器也会被前缀化（不再污染宿主）", () => {
		expect(prefixCss("body{margin:0}", P)).toBe(`.${P} body{margin:0}`);
		expect(prefixCss("*{box-sizing:border-box}", P)).toBe(
			`.${P} *{box-sizing:border-box}`,
		);
		expect(prefixCss(":root{--x:1}", P)).toBe(`.${P} :root{--x:1}`);
	});

	it("字符串与注释内的花括号不会被误判为规则体", () => {
		expect(prefixCss('.x{content:"{";}', P)).toBe(`.${P} .x{content:"{";}`);
		expect(prefixCss(".x{} /* } */ .y{}", P)).toBe(
			`.${P} .x{}/* } */.${P} .y{}`,
		);
	});

	it("伪类选择器正常加前缀", () => {
		expect(prefixCss("a:hover{color:blue}", P)).toBe(
			`.${P} a:hover{color:blue}`,
		);
	});
});

describe("scopeCssOfHtml", () => {
	it("改写 <style> 内选择器", () => {
		const html = '<style>.hero{color:red}</style><div class="hero">x</div>';
		expect(scopeCssOfHtml(html, P)).toBe(
			`<style>.${P} .hero{color:red}</style><div class="hero">x</div>`,
		);
	});

	it("多个 <style> 块逐个改写并保留标签属性", () => {
		const html = '<style media="screen">.a{}</style><p></p><style>.b{}</style>';
		expect(scopeCssOfHtml(html, P)).toBe(
			`<style media="screen">.${P} .a{}</style><p></p><style>.${P} .b{}</style>`,
		);
	});

	it("无 <style> 时原样返回且不改变内联样式", () => {
		const html = '<section style="color:red"><h2>标题</h2></section>';
		expect(scopeCssOfHtml(html, P)).toBe(html);
	});
});

describe("scopedRichContent", () => {
	it("用传入前缀包进作用域容器并把 style 选择器改名", () => {
		const html = '<style>.hero{}</style><div class="hero">x</div>';
		expect(scopedRichContent(html, "rich-content-demo")).toBe(
			'<div class="rich-content-demo"><style>.rich-content-demo .hero{}</style><div class="hero">x</div></div>',
		);
	});

	it("未传前缀时临时生成随机前缀并包裹（兜底）", () => {
		const html = "<p>hi</p>";
		const result = scopedRichContent(html);
		expect(result).toMatch(
			/^<div class="rich-content-[a-z0-9]{4,}"><p>hi<\/p><\/div>$/i,
		);
	});
});
