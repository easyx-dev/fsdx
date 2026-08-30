/**
 * 通用 AI 流式对话服务层测试：systemPrompt 透传、通用默认 maxTokens
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDeepChatStream } = vi.hoisted(() => ({
	mockDeepChatStream: vi.fn(),
}));
vi.mock("@fsdx/core/ai", () => ({
	deepChatStream: mockDeepChatStream,
}));

import { AI_CHAT_DEFAULT_MAX_TOKENS, streamAiChat } from "../ai-chat.server";

describe("streamAiChat", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockDeepChatStream.mockResolvedValue({
			content: "<div>生成结果</div>",
			model: "deep-model",
		});
	});

	it("将外部 system 提示词作为首条 system 消息并透传历史", async () => {
		await streamAiChat({
			messages: [
				{ role: "user", content: "生成页面" },
				{ role: "assistant", content: "<p>旧</p>" },
			],
			systemPrompt: "你是 HTML 生成助手",
		});
		expect(mockDeepChatStream).toHaveBeenCalledTimes(1);
		const [messages, options] = mockDeepChatStream.mock.calls[0];
		expect(messages[0]).toEqual({
			role: "system",
			content: "你是 HTML 生成助手",
		});
		expect(messages.slice(1)).toEqual([
			{ role: "user", content: "生成页面" },
			{ role: "assistant", content: "<p>旧</p>" },
		]);
		// 未指定 maxTokens 时使用通用默认值
		expect(options.maxTokens).toBe(AI_CHAT_DEFAULT_MAX_TOKENS);
		expect(options.temperature).toBeUndefined();
	});

	it("透传 temperature、maxTokens 与流式回调", async () => {
		const onToken = vi.fn();
		const onThinking = vi.fn();
		const onAttemptChange = vi.fn();
		mockDeepChatStream.mockImplementation(
			async (_m, _o, token, think, attempt) => {
				token?.("a");
				think?.("推理中");
				attempt?.("fast");
				return { content: "ok", model: "m" };
			},
		);
		const result = await streamAiChat(
			{
				messages: [{ role: "user", content: "hi" }],
				systemPrompt: "你是助手",
				temperature: 0.5,
				maxTokens: 2048,
			},
			{ onToken, onThinking, onAttemptChange },
		);
		expect(result).toEqual({ content: "ok", model: "m" });
		const [, options] = mockDeepChatStream.mock.calls[0];
		expect(options.temperature).toBe(0.5);
		expect(options.maxTokens).toBe(2048);
		expect(onToken).toHaveBeenCalledWith("a");
		expect(onThinking).toHaveBeenCalledWith("推理中");
		expect(onAttemptChange).toHaveBeenCalledWith("fast");
	});
});
