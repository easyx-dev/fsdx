/**
 * AI 厂商配置服务测试：fetchProviderModels 拉取 OpenAI 兼容 /models 端点
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));

vi.mock("#/services/config/config.server", () => ({
	upsertConfig: vi.fn(),
}));
vi.mock("#/lib/logger/logger", () => ({
	logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { fetchProviderModels } from "../ai-providers.server";

/** 构造一个 OK 的 fetch 响应 */
function okResponse(data: unknown): Response {
	return {
		ok: true,
		status: 200,
		json: vi.fn().mockResolvedValue(data),
	} as unknown as Response;
}

/** 构造一个非 OK 的 fetch 响应 */
function errResponse(status: number): Response {
	return { ok: false, status } as unknown as Response;
}

beforeEach(() => {
	mockFetch.mockReset();
	vi.stubGlobal("fetch", mockFetch);
});

describe("fetchProviderModels", () => {
	it("拼接收尾去斜杠的 baseUrl 并带 Bearer 头，返回模型 id 列表", async () => {
		mockFetch.mockResolvedValue(
			okResponse({
				data: [{ id: "deepseek-chat" }, { id: "deepseek-reasoner" }],
			}),
		);
		const ids = await fetchProviderModels(
			"https://api.deepseek.com/v1/",
			"sk-test",
		);
		expect(ids).toEqual(["deepseek-chat", "deepseek-reasoner"]);
		expect(mockFetch).toHaveBeenCalledWith(
			"https://api.deepseek.com/v1/models",
			expect.objectContaining({
				headers: { Authorization: "Bearer sk-test" },
			}),
		);
	});

	it("HTTP 非 200 时抛含状态码的友好错误", async () => {
		mockFetch.mockResolvedValue(errResponse(401));
		await expect(
			fetchProviderModels("https://api.deepseek.com/v1", "sk"),
		).rejects.toThrow("HTTP 401");
	});

	it("响应 data 非数组时抛格式异常", async () => {
		mockFetch.mockResolvedValue(okResponse({ data: "oops" }));
		await expect(
			fetchProviderModels("https://api.deepseek.com/v1", "sk"),
		).rejects.toThrow("响应格式异常");
	});

	it("data 为空数组时抛未获取到模型", async () => {
		mockFetch.mockResolvedValue(okResponse({ data: [] }));
		await expect(
			fetchProviderModels("https://api.deepseek.com/v1", "sk"),
		).rejects.toThrow("未获取到可用模型");
	});

	it("网络异常时抛连接失败", async () => {
		mockFetch.mockRejectedValue(new Error("network"));
		await expect(
			fetchProviderModels("https://api.deepseek.com/v1", "sk"),
		).rejects.toThrow("连接 AI 服务失败");
	});
});
