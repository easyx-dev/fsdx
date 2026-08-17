/**
 * AI SDK 封装测试：深度思考与快速模型调用、未初始化 fail-fast
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "../../logger";

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

// 所有 mock 之后导入被测模块
import { deepChat, fastChat, initAi, resetAiForTest } from "../index";

describe("deepChat", () => {
	beforeEach(() => {
		mockCreate.mockClear();
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

		expect(result).not.toBeNull();
		expect(result!.content).toBe("深度思考回复");
		expect(result!.model).toBe("gpt-4o");
		expect(result!.usage).toEqual({
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

		expect(result).not.toBeNull();
		expect(result!.content).toBe("明确答复");
	});
});

describe("fastChat", () => {
	beforeEach(() => {
		mockCreate.mockClear();
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
	});

	it("快速模型调用成功返回结果", async () => {
		mockCreate.mockResolvedValueOnce({
			choices: [{ message: { content: "快速回复" } }],
			model: "gpt-4o-mini",
			usage: {
				prompt_tokens: 5,
				completionTokens: 10,
				total_tokens: 15,
			},
		});

		const result = await fastChat([
			{ role: "user", content: "今天天气怎么样" },
		]);

		expect(result).not.toBeNull();
		expect(result!.content).toBe("快速回复");
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
});

describe("AI 调用异常处理", () => {
	beforeEach(() => {
		mockCreate.mockClear();
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
	});

	it("API 调用失败抛出异常", async () => {
		mockCreate.mockRejectedValueOnce(new Error("API 连接超时"));

		await expect(deepChat([{ role: "user", content: "测试" }])).rejects.toThrow(
			"API 连接超时",
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
