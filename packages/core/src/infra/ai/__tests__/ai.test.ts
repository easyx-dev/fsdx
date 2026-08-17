/**
 * AI 模块测试：深度/快速模型调用、降级重试、空内容重试、流式调用、参数透传、fail-fast
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "../../logger";
import { truncateJsonForLlm } from "../truncate";

const mockCreate = vi.fn();
const mockGetConfig = vi.fn();
const mockLogger = {
	error: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
	debug: vi.fn(),
	trace: vi.fn(),
	fatal: vi.fn(),
} as unknown as Logger;

vi.mock("openai", () => ({
	// biome-ignore lint/complexity/useArrowFunction: 必须用 function 以支持 new 构造调用
	default: vi.fn(function () {
		return { chat: { completions: { create: mockCreate } } };
	}),
}));

// 空内容重试与降级重试中的退避延迟在测试中直接跳过，避免拖慢用例
vi.mock("../client", async (importOriginal) => {
	const original = await importOriginal<typeof import("../client")>();
	return { ...original, delay: vi.fn(() => Promise.resolve()) };
});

// 所有 mock 之后导入被测模块
import {
	deepChat,
	deepChatStream,
	fastChat,
	fastChatStream,
	initAi,
	resetAiForTest,
} from "../index";

/** 通用测试配置：init 注入 + 默认模型配置 */
function setupDefaultConfig(): void {
	mockGetConfig.mockReset();
	mockGetConfig.mockImplementation((key: string) => {
		const map: Record<string, string> = {
			ai_base_url: "https://api.openai.com/v1",
			ai_api_key: "sk-test-key",
			ai_deep_model: "gpt-4o",
			ai_fast_model: "gpt-4o-mini",
		};
		return map[key] ?? "";
	});
	resetAiForTest();
	initAi({ getConfig: mockGetConfig, logger: mockLogger });
}

describe("deepChat", () => {
	beforeEach(() => {
		mockCreate.mockClear();
		setupDefaultConfig();
	});

	it("深度思考模型调用成功返回结果", async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [{ message: { content: "深度思考回复" } }],
			model: "gpt-4o",
			usage: {
				prompt_tokens: 10,
				completion_tokens: 20,
				total_tokens: 30,
			},
		});

		const result = await deepChat([{ role: "user", content: "解释量子力学" }]);

		expect(result.content).toBe("深度思考回复");
		expect(result.model).toBe("gpt-4o");
		expect(result.usage).toEqual({
			promptTokens: 10,
			completionTokens: 20,
			totalTokens: 30,
		});
	});

	it("支持 system 消息", async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [{ message: { content: "明确答复" } }],
		});

		const result = await deepChat([
			{ role: "system", content: "你是一个助手" },
			{ role: "user", content: "你好" },
		]);

		expect(result.content).toBe("明确答复");
	});

	it("deep 模型失败时自动降级 fast 重试", async () => {
		mockCreate
			.mockRejectedValueOnce(new Error("API 连接超时"))
			.mockResolvedValueOnce({
				choices: [{ message: { content: "降级后的回复" } }],
				model: "gpt-4o-mini",
			});

		const result = await deepChat([{ role: "user", content: "测试" }]);

		expect(result.content).toBe("降级后的回复");
		expect(result.model).toBe("gpt-4o-mini");
		expect(mockCreate).toHaveBeenCalledTimes(2);
	});

	it("deep 与 fast 均失败时抛出最后一个错误", async () => {
		mockCreate.mockRejectedValue(new Error("API 连接超时"));

		await expect(deepChat([{ role: "user", content: "测试" }])).rejects.toThrow(
			"API 连接超时",
		);
		expect(mockCreate).toHaveBeenCalledTimes(2);
	});

	it("空内容在单模型内参数变化重试与降级后仍为空则抛错", async () => {
		mockCreate.mockResolvedValue({ choices: [{ message: { content: "" } }] });

		await expect(deepChat([{ role: "user", content: "测试" }])).rejects.toThrow(
			"AI 返回空内容",
		);
		// 空内容重试上限 2 次 + 首次调用 = 3 次，重试失败后降级 fast 再 3 次
		expect(mockCreate).toHaveBeenCalledTimes(6);
	});
});

describe("fastChat", () => {
	beforeEach(() => {
		mockCreate.mockClear();
		setupDefaultConfig();
	});

	it("快速模型调用成功返回结果", async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [{ message: { content: "快速回复" } }],
			model: "gpt-4o-mini",
		});

		const result = await fastChat([
			{ role: "user", content: "今天天气怎么样" },
		]);

		expect(result.content).toBe("快速回复");
		expect(result.model).toBe("gpt-4o-mini");
	});

	it("支持自定义 temperature 和 maxTokens", async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [{ message: { content: "OK" } }],
		});

		await fastChat([{ role: "user", content: "hi" }], {
			temperature: 0.3,
			maxTokens: 100,
		});

		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				temperature: 0.3,
				max_tokens: 100,
			}),
		);
	});

	it("透传 extraBody，关闭思考时不传 temperature", async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [{ message: { content: "OK" } }],
		});

		await fastChat([{ role: "user", content: "hi" }], {
			extraBody: { thinking: { type: "disabled" } },
		});

		const params = mockCreate.mock.calls[0][0];
		expect(params.extra_body).toEqual({ thinking: { type: "disabled" } });
		expect(params).not.toHaveProperty("temperature");
	});

	it("thinking 关闭时空内容重试全程不注入 temperature", async () => {
		mockCreate.mockResolvedValue({ choices: [{ message: { content: "" } }] });

		await expect(
			fastChat([{ role: "user", content: "hi" }], {
				extraBody: { thinking: { type: "disabled" } },
			}),
		).rejects.toThrow("AI 返回空内容");

		expect(mockCreate).toHaveBeenCalledTimes(3);
		for (const call of mockCreate.mock.calls) {
			const params = call[0] as Record<string, unknown>;
			expect(params).not.toHaveProperty("temperature");
			expect(params.extra_body).toEqual({ thinking: { type: "disabled" } });
		}
	});
});

describe("AI 流式调用", () => {
	beforeEach(() => {
		mockCreate.mockClear();
		setupDefaultConfig();
	});

	it("深度模型流式成功，逐 token 与思考内容回调", async () => {
		mockCreate.mockResolvedValueOnce(
			(async function* () {
				yield {
					choices: [{ delta: { content: "你", reasoning_content: "先思考" } }],
				};
				yield { choices: [{ delta: { content: "好" } }] };
				yield {
					choices: [{ delta: { content: "" } }],
					usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
				};
			})(),
		);

		const tokens: string[] = [];
		const thoughts: string[] = [];
		const result = await deepChatStream(
			[{ role: "user", content: "你好" }],
			undefined,
			(delta) => tokens.push(delta),
			(delta) => thoughts.push(delta),
		);

		expect(result.content).toBe("你好");
		expect(result.usage).toEqual({
			promptTokens: 3,
			completionTokens: 2,
			totalTokens: 5,
		});
		expect(tokens).toEqual(["你", "好"]);
		expect(thoughts).toEqual(["先思考"]);
	});

	it("深度模型流式失败时降级 fast 并触发 onAttemptChange", async () => {
		mockCreate
			.mockRejectedValueOnce(new Error("流式中断"))
			.mockResolvedValueOnce(
				(async function* () {
					yield { choices: [{ delta: { content: "fast 兜底" } }] };
				})(),
			);

		const attempts: string[] = [];
		const result = await deepChatStream(
			[{ role: "user", content: "测试" }],
			undefined,
			undefined,
			undefined,
			(type) => attempts.push(type),
		);

		expect(result.content).toBe("fast 兜底");
		expect(attempts).toEqual(["fast"]);
		expect(mockCreate).toHaveBeenCalledTimes(2);
	});

	it("快速模型流式空内容重试后仍为空则抛错", async () => {
		mockCreate.mockResolvedValue(
			(async function* () {
				yield { choices: [{ delta: { content: "" } }] };
			})(),
		);

		await expect(
			fastChatStream([{ role: "user", content: "测试" }]),
		).rejects.toThrow("AI 返回空内容");
		expect(mockCreate).toHaveBeenCalledTimes(3);
	});
});

describe("AI 调用异常处理", () => {
	beforeEach(() => {
		mockCreate.mockClear();
		setupDefaultConfig();
	});

	it("AI 客户端未配置时抛错", async () => {
		mockGetConfig.mockResolvedValue("");

		await expect(fastChat([{ role: "user", content: "测试" }])).rejects.toThrow(
			"AI 客户端未配置",
		);
	});
});

describe("initAi", () => {
	it("未初始化时调用 deepChat 抛错（fail-fast）", async () => {
		resetAiForTest();
		await expect(deepChat([{ role: "user", content: "测试" }])).rejects.toThrow(
			"请先调用 initAi()",
		);
	});
});

describe("truncateJsonForLlm", () => {
	it("未超限时原样返回", () => {
		const json = JSON.stringify({ a: 1 });
		expect(truncateJsonForLlm(json)).toBe(json);
	});

	it("数组保留前 3 项并标注总数", () => {
		const json = JSON.stringify({
			items: Array.from({ length: 100 }, (_, i) => i),
		});
		const result = truncateJsonForLlm(json, 100);
		expect(result).toContain("共 100 项，已截断");
		expect(result).not.toContain('"3"');
	});

	it("超长字符串截断到 500 字符并标注原始长度", () => {
		const long = "x".repeat(600);
		const result = truncateJsonForLlm(JSON.stringify(long), 550);
		expect(result).toContain("原始长度 600 字符");
		expect(result.length).toBeLessThan(600);
	});

	it("非法 JSON 直接按字符截断", () => {
		const raw = `not-json-${"y".repeat(100)}`;
		const result = truncateJsonForLlm(raw, 20);
		expect(result.length).toBeLessThan(raw.length);
		expect(result).toContain("已截断");
	});
});
