/**
 * MarkdownContent 渲染测试：XMarkdown 文本 / ```html 代码块「应用到编辑器」回调 / 空回复占位
 */
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MarkdownContent } from "../MarkdownContent";

afterEach(() => cleanup());

describe("MarkdownContent", () => {
	it("渲染文本与 ```html 代码块，点击「应用到编辑器」回调代码块内容", () => {
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
		// 块级代码落入 pre code（带等宽块样式类）
		const blockCode = container.querySelector("pre code");
		expect(blockCode).toBeTruthy();
		expect(blockCode!.textContent).toContain("line1");
	});

	it("html 代码块渲染「HTML」标签与代码内容", () => {
		const { container } = render(
			<MarkdownContent content={"```html\n<div>x</div>\n```"} />,
		);
		expect(screen.getByText("HTML")).toBeTruthy();
		expect(screen.getByText("<div>x</div>")).toBeTruthy();
		// 头部含复制按钮
		expect(container.querySelectorAll("button").length).toBeGreaterThan(0);
	});
});
