/**
 * useAiChat 测试：基于 useChat 的消息映射、流式占位、发送（systemPrompt 透传）、中止、清空、错误与完成回调
 */
// @vitest-environment jsdom
import type { UIMessage } from "@tanstack/ai-react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDefaultSystemPrompt } from "../../prompts";
import { useAiChat } from "../useAiChat";

const { mockUseChat, mockFetchServerSentEvents } = vi.hoisted(() => ({
	mockUseChat: vi.fn(),
	mockFetchServerSentEvents: vi.fn(),
}));

vi.mock("@tanstack/ai-react", () => ({
	useChat: mockUseChat,
	fetchServerSentEvents: mockFetchServerSentEvents,
}));

/** 构造一条 UIMessage（仅含 text/thinking part） */
function makeUIMessage(
	role: "user" | "assistant",
	parts: Array<{ type: "text" | "thinking"; content: string }>,
): UIMessage {
	return { id: `m-${Math.random()}`, role, parts } as UIMessage;
}

/** 设置 useChat 的返回值 */
function setupUseChat(overrides: Record<string, unknown> = {}) {
	const ret = {
		messages: [],
		sendMessage: vi.fn().mockResolvedValue(undefined),
		stop: vi.fn(),
		setMessages: vi.fn(),
		isLoading: false,
		error: undefined,
		...overrides,
	};
	mockUseChat.mockReturnValue(ret);
	return ret;
}

describe("useAiChat", () => {
	beforeEach(() => {
		mockUseChat.mockReset();
		mockFetchServerSentEvents.mockReset();
		mockFetchServerSentEvents.mockReturnValue({});
	});

	it("空对话时 messages / streamText / isStreaming 为初始值", () => {
		setupUseChat();
		const { result } = renderHook(() =>
			useAiChat({ endpointUrl: "/api/ai-chat" }),
		);
		expect(result.current.messages).toEqual([]);
		expect(result.current.streamText).toBe("");
		expect(result.current.thinkingText).toBe("");
		expect(result.current.isStreaming).toBe(false);
		expect(result.current.error).toBeNull();
	});

	it("将 UIMessage 映射为 ChatTurn（text 拼接、thinking 单独字段）", () => {
		setupUseChat({
			messages: [
				makeUIMessage("user", [{ type: "text", content: "你好" }]),
				makeUIMessage("assistant", [
					{ type: "text", content: "回答" },
					{ type: "thinking", content: "先思考" },
				]),
			],
		});
		const { result } = renderHook(() =>
			useAiChat({ endpointUrl: "/api/ai-chat" }),
		);
		expect(result.current.messages).toEqual([
			{ role: "user", content: "你好", thinking: undefined },
			{ role: "assistant", content: "回答", thinking: "先思考" },
		]);
	});

	it("流式时移除末条 assistant 占位并暴露 streamText / thinkingText", () => {
		setupUseChat({
			isLoading: true,
			messages: [
				makeUIMessage("user", [{ type: "text", content: "你好" }]),
				makeUIMessage("assistant", [
					{ type: "thinking", content: "推理中" },
					{ type: "text", content: "逐字" },
				]),
			],
		});
		const { result } = renderHook(() =>
			useAiChat({ endpointUrl: "/api/ai-chat" }),
		);
		expect(result.current.messages).toEqual([
			{ role: "user", content: "你好", thinking: undefined },
		]);
		expect(result.current.streamText).toBe("逐字");
		expect(result.current.thinkingText).toBe("推理中");
		expect(result.current.isStreaming).toBe(true);
	});

	it("send 透传文本与默认 systemPrompt", async () => {
		const chat = setupUseChat();
		const { result } = renderHook(() =>
			useAiChat({ endpointUrl: "/api/ai-chat" }),
		);
		await act(async () => {
			await result.current.send("  生成页面  ");
		});
		expect(chat.sendMessage).toHaveBeenCalledWith("生成页面", {
			body: { systemPrompt: buildDefaultSystemPrompt() },
		});
	});

	it("send 使用自定义 systemPrompt（trim 后为空不发送）", async () => {
		const chat = setupUseChat();
		const { result } = renderHook(() =>
			useAiChat({ endpointUrl: "/api/ai-chat", systemPrompt: "你是助手" }),
		);
		await act(async () => {
			await result.current.send("  ");
		});
		expect(chat.sendMessage).not.toHaveBeenCalled();

		await act(async () => {
			await result.current.send("继续");
		});
		expect(chat.sendMessage).toHaveBeenCalledWith("继续", {
			body: { systemPrompt: "你是助手" },
		});
	});

	it("流式进行中 send 不触发", async () => {
		const chat = setupUseChat({ isLoading: true });
		const { result } = renderHook(() =>
			useAiChat({ endpointUrl: "/api/ai-chat" }),
		);
		await act(async () => {
			await result.current.send("hi");
		});
		expect(chat.sendMessage).not.toHaveBeenCalled();
	});

	it("stop / clear 委派给 useChat", () => {
		const chat = setupUseChat();
		const { result } = renderHook(() =>
			useAiChat({ endpointUrl: "/api/ai-chat" }),
		);
		act(() => result.current.stop());
		expect(chat.stop).toHaveBeenCalled();
		act(() => result.current.clear());
		expect(chat.setMessages).toHaveBeenCalledWith([]);
	});

	it("error 映射为 message，onFinish 触发 onComplete", () => {
		const onComplete = vi.fn();
		setupUseChat({ error: new Error("boom") });
		renderHook(() => useAiChat({ endpointUrl: "/api/ai-chat", onComplete }));
		// 从 useChat 的 options.onFinish 触发完成回调
		const options = mockUseChat.mock.calls[0][0];
		const doneMessage = makeUIMessage("assistant", [
			{ type: "text", content: "完成内容" },
		]);
		options.onFinish(doneMessage);
		expect(onComplete).toHaveBeenCalledWith("完成内容");
	});
});

describe("useAiChat error", () => {
	it("暴露 useChat 的错误信息", () => {
		setupUseChat({ error: new Error("AI 调用失败") });
		const { result } = renderHook(() =>
			useAiChat({ endpointUrl: "/api/ai-chat" }),
		);
		expect(result.current.error).toBe("AI 调用失败");
	});
});
