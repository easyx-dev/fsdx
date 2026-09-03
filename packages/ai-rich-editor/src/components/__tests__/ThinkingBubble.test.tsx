/**
 * ThinkingBubble 渲染测试：思考内容展示、流式中「思考中…」、空内容不渲染
 */
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ThinkingBubble } from "../ThinkingBubble";

afterEach(() => cleanup());

describe("ThinkingBubble", () => {
	it("空思考内容不渲染", () => {
		const { container } = render(<ThinkingBubble thinking="" />);
		expect(container.firstChild).toBeNull();
	});

	it("流式中显示「思考中…」并展示字符数，默认收起全文", () => {
		render(<ThinkingBubble thinking="推理过程" streaming />);
		expect(screen.getByText("思考中…")).toBeTruthy();
		expect(screen.getByText("(4 字)")).toBeTruthy();
		// 收起时正文不可见
		expect(screen.queryByText("推理过程")).toBeNull();
	});

	it("非流式中显示「已思考」，点击展开可见全文", () => {
		render(<ThinkingBubble thinking="完整思考" />);
		expect(screen.getByText("已思考")).toBeTruthy();
		// 初始收起
		expect(screen.queryByText("完整思考")).toBeNull();
		fireEvent.click(screen.getByRole("button"));
		expect(screen.getByText("完整思考")).toBeTruthy();
	});
});
