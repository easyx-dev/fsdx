/**
 * MarkdownContent 渲染测试：文本块 / ```html 代码块拆分与「应用到编辑器」回调
 */
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarkdownContent, splitContentBlocks } from "../MarkdownContent";

afterEach(() => cleanup());

describe("splitContentBlocks", () => {
	it("把内容拆分为文本块与 html 代码块", () => {
		const blocks = splitContentBlocks(
			"说明\n```html\n<div>hi</div>\n```\n尾部",
		);
		expect(blocks).toEqual([
			{ kind: "text", text: "说明" },
			{ kind: "code", html: "<div>hi</div>" },
			{ kind: "text", text: "尾部" },
		]);
	});

	it("无代码块时仅文本块", () => {
		expect(splitContentBlocks("只文本")).toEqual([
			{ kind: "text", text: "只文本" },
		]);
	});

	it("空回复返回空数组", () => {
		expect(splitContentBlocks("")).toEqual([]);
	});
});

describe("MarkdownContent", () => {
	it("渲染文本块与代码块，点击「应用到编辑器」回调代码块内容", () => {
		const onApplyHtml = vi.fn();
		render(
			<MarkdownContent
				content={"说明\n```html\n<div>hi</div>\n```"}
				onApplyHtml={onApplyHtml}
			/>,
		);
		expect(screen.getByText("说明")).toBeTruthy();
		expect(screen.getByText("<div>hi</div>")).toBeTruthy();
		fireEvent.click(screen.getByText("应用到编辑器"));
		expect(onApplyHtml).toHaveBeenCalledWith("<div>hi</div>");
	});

	it("空回复显示占位文案", () => {
		render(<MarkdownContent content="" />);
		expect(screen.getByText("(空回复)")).toBeTruthy();
	});

	it("渲染 markdown（标题/加粗/行内代码/列表）", () => {
		render(
			<MarkdownContent
				content={"## 常见原因\n**注意** 与 `行内代码`\n- 原因一\n- 原因二"}
			/>,
		);
		expect(screen.getByText("常见原因")).toBeTruthy();
		expect(screen.getByText("注意")).toBeTruthy();
		expect(screen.getByText("行内代码")).toBeTruthy();
		expect(screen.getByText("原因一")).toBeTruthy();
		expect(screen.getByText("原因二")).toBeTruthy();
	});

	it("无语言围栏代码块按块级渲染（而非行内圆块）", () => {
		const { container } = render(
			<MarkdownContent content={"```\nline1\nline2\n```"} />,
		);
		const blockCode = container.querySelector("pre code");
		expect(blockCode).toBeTruthy();
		expect(blockCode!.className).toContain("block");
	});

	it("行内代码渲染为圆角块", () => {
		const { container } = render(
			<MarkdownContent content={"用 `inline` 表示"} />,
		);
		const inlineCode = container.querySelector("p code");
		expect(inlineCode).toBeTruthy();
		expect(inlineCode!.className).toContain("rounded");
	});
});
