/**
 * OpenAI 兼容代理测试：请求体校验、SSE 编码（增量 / 终止哨兵 / 流内错误）、无厂商与上游失败路径
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAiRawClient } = vi.hoisted(() => ({
	mockGetAiRawClient: vi.fn(),
}));

vi.mock("../ai.provider", () => ({
	getAiRawClient: mockGetAiRawClient,
}));

import {
	encodeOpenAiSseStream,
	openAiChatRequestSchema,
	proxyOpenAiChat,
} from "../ai.proxy.server";

/** 逐块产出的异步迭代器 */
async function* fromArray<T>(items: T[]): AsyncGenerator<T> {
	for (const item of items) yield item;
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("openAiChatRequestSchema", () => {
	it("接受文本与多模态内容块（system 可置于首位）", () => {
		const parsed = openAiChatRequestSchema.safeParse({
			messages: [
				{ role: "system", content: "你是助手" },
				{ role: "user", content: "hi" },
				{
					role: "user",
					content: [{ type: "text", text: "看图" }],
				},
			],
			stream: true,
		});
		expect(parsed.success).toBe(true);
	});

	it("空消息数组与非法角色被拒绝", () => {
		expect(openAiChatRequestSchema.safeParse({ messages: [] }).success).toBe(
			false,
		);
		expect(
			openAiChatRequestSchema.safeParse({
				messages: [{ role: "tool", content: "x" }],
			}).success,
		).toBe(false);
	});
});

describe("encodeOpenAiSseStream", () => {
	it("逐块编码为 data 行并以 [DONE] 收尾", async () => {
		const stream = encodeOpenAiSseStream(fromArray([{ a: 1 }, { b: 2 }]));
		const text = await new Response(stream).text();
		expect(text).toBe('data: {"a":1}\n\ndata: {"b":2}\n\ndata: [DONE]\n\n');
	});

	it("流内异常编码为 error 事件后收尾（不再抛出）", async () => {
		async function* failing(): AsyncGenerator<unknown> {
			yield { ok: 1 };
			throw new Error("上游断流");
		}
		const text = await new Response(encodeOpenAiSseStream(failing())).text();
		expect(text).toContain('data: {"ok":1}\n\n');
		expect(text).toContain('data: {"error":{"message":"上游断流"}}\n\n');
	});
});

describe("proxyOpenAiChat", () => {
	it("无可用厂商时返回 503 JSON 错误体", async () => {
		mockGetAiRawClient.mockResolvedValue(null);
		const res = await proxyOpenAiChat({
			messages: [{ role: "user", content: "hi" }],
		});
		expect(res.status).toBe(503);
		expect(await res.json()).toEqual({
			error: { message: "AI 客户端未配置，请检查 ai_providers 配置" },
		});
	});

	it("直通厂商流式增量并以 [DONE] 收尾", async () => {
		const create = vi
			.fn()
			.mockResolvedValue(
				fromArray([
					{ choices: [{ delta: { content: "你" } }] },
					{ choices: [{ delta: { content: "好" }, finish_reason: "stop" }] },
				]),
			);
		mockGetAiRawClient.mockResolvedValue({
			client: { chat: { completions: { create } } },
			model: "deepseek-chat",
		});

		const res = await proxyOpenAiChat({
			messages: [{ role: "user", content: "hi" }],
			providerId: "deepseek",
		});
		expect(res.headers.get("content-type")).toContain("text/event-stream");
		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({ model: "deepseek-chat", stream: true }),
			expect.anything(),
		);

		const text = await res.text();
		expect(text).toContain(
			'data: {"choices":[{"delta":{"content":"你"}}]}\n\n',
		);
		expect(text.endsWith("data: [DONE]\n\n")).toBe(true);
	});

	it("上游请求失败时返回 502 JSON 错误体", async () => {
		const create = vi.fn().mockRejectedValue(new Error("401 Unauthorized"));
		mockGetAiRawClient.mockResolvedValue({
			client: { chat: { completions: { create } } },
			model: "deepseek-chat",
		});

		const res = await proxyOpenAiChat({
			messages: [{ role: "user", content: "hi" }],
		});
		expect(res.status).toBe(502);
		expect(await res.json()).toEqual({
			error: { message: "401 Unauthorized" },
		});
	});
});
