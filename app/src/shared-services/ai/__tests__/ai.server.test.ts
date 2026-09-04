/**
 * AI 服务编排层测试：streamAiChat 流式透传、completeText 非流式取文本、未配置 fail-fast
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockChat, mockGetAiAdapter } = vi.hoisted(() => ({
	mockChat: vi.fn(),
	mockGetAiAdapter: vi.fn(),
}));

vi.mock("@tanstack/ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@tanstack/ai")>();
	return { ...actual, chat: mockChat };
});

vi.mock("../ai.provider", () => ({
	getAiAdapter: mockGetAiAdapter,
}));

import { completeText, streamAiChat } from "../ai.server";

const mockAdapter = { kind: "text" } as never;

describe("streamAiChat", () => {
	beforeEach(() => {
		mockChat.mockClear();
		mockGetAiAdapter.mockReset();
	});

	it("未配置时抛友好错误", async () => {
		mockGetAiAdapter.mockResolvedValue(null);
		await expect(
			streamAiChat({ messages: [{ role: "user", content: "hi" }] }),
		).rejects.toThrow("AI 客户端未配置");
		expect(mockChat).not.toHaveBeenCalled();
	});

	it("透传 providerId/messages/systemPrompts/modelOptions/threadId/runId，返回流", async () => {
		mockGetAiAdapter.mockResolvedValue(mockAdapter);
		const stream = { kind: "stream" } as never;
		mockChat.mockResolvedValue(stream);

		const result = await streamAiChat({
			messages: [{ role: "user", content: "hi" }],
			systemPrompts: ["你是助手"],
			providerId: "deepseek",
			modelOptions: { temperature: 0.7, max_tokens: 4096 },
			threadId: "t1",
			runId: "r1",
		});

		expect(mockGetAiAdapter).toHaveBeenCalledWith("deepseek");
		expect(result).toBe(stream);
		expect(mockChat).toHaveBeenCalledWith(
			expect.objectContaining({
				adapter: mockAdapter,
				messages: [{ role: "user", content: "hi" }],
				systemPrompts: ["你是助手"],
				modelOptions: { temperature: 0.7, max_tokens: 4096 },
				threadId: "t1",
				runId: "r1",
			}),
		);
	});

	it("不传 providerId/systemPrompts/threadId/runId 时透传 undefined", async () => {
		mockGetAiAdapter.mockResolvedValue(mockAdapter);
		mockChat.mockResolvedValue({} as never);

		await streamAiChat({ messages: [{ role: "user", content: "hi" }] });

		expect(mockGetAiAdapter).toHaveBeenCalledWith(undefined);
		expect(mockChat).toHaveBeenCalledWith(
			expect.objectContaining({
				systemPrompts: undefined,
				threadId: undefined,
				runId: undefined,
			}),
		);
	});
});

describe("completeText", () => {
	beforeEach(() => {
		mockChat.mockClear();
		mockGetAiAdapter.mockReset();
	});

	it("未配置时抛友好错误", async () => {
		mockGetAiAdapter.mockResolvedValue(null);
		await expect(
			completeText({ messages: [{ role: "user", content: "hi" }] }),
		).rejects.toThrow("AI 客户端未配置");
	});

	it("以 stream: false 调用并返回完整文本（透传 providerId）", async () => {
		mockGetAiAdapter.mockResolvedValue(mockAdapter);
		mockChat.mockResolvedValue("译文内容");

		const result = await completeText({
			messages: [{ role: "user", content: "请翻译" }],
			providerId: "moonshot",
			modelOptions: { temperature: 0.3 },
		});

		expect(mockGetAiAdapter).toHaveBeenCalledWith("moonshot");
		expect(result).toBe("译文内容");
		expect(mockChat).toHaveBeenCalledWith(
			expect.objectContaining({
				adapter: mockAdapter,
				messages: [{ role: "user", content: "请翻译" }],
				modelOptions: { temperature: 0.3 },
				stream: false,
			}),
		);
	});
});
