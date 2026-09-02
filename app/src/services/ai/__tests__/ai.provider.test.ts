/**
 * AI 客户端测试：多厂商配置读取/校验、resolveProvider 命中规则、provider 按厂商缓存构建、adapter 构建
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetConfig, mockLogger, mockOpenaiCompatible } = vi.hoisted(() => ({
	mockGetConfig: vi.fn(),
	mockLogger: {
		error: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
		trace: vi.fn(),
		fatal: vi.fn(),
	},
	mockOpenaiCompatible: vi.fn(),
}));

vi.mock("#/services/config/config.server", () => ({
	getConfig: mockGetConfig,
}));

vi.mock("#/lib/logger/logger", () => ({
	logger: mockLogger,
}));

vi.mock("@tanstack/ai-openai/compatible", () => ({
	openaiCompatible: mockOpenaiCompatible,
}));

import {
	getAiAdapter,
	getAiProvider,
	readProviderConfig,
	readProviders,
	resolveProvider,
} from "../ai.provider";
import type { AiProviderConfig } from "../ai.schemas";

/** 通用厂商列表 */
const PROVIDERS: AiProviderConfig[] = [
	{
		id: "deepseek",
		name: "DeepSeek",
		baseUrl: "https://api.deepseek.com/v1",
		apiKey: "sk-ds",
		model: "deepseek-chat",
		default: true,
	},
	{
		id: "moonshot",
		name: "Moonshot",
		baseUrl: "https://api.moonshot.ai/v1",
		apiKey: "sk-ms",
		model: "kimi-k2-0711-preview",
	},
];

/** 用给定 providers 配置 getConfig */
function setConfig(providers: AiProviderConfig[] | string): void {
	mockGetConfig.mockReset();
	mockGetConfig.mockImplementation((key: string) =>
		key === "ai_providers"
			? typeof providers === "string"
				? providers
				: JSON.stringify(providers)
			: "",
	);
}

beforeEach(() => {
	// 清理跨用例残留的 globalThis 共享缓存
	(globalThis as Record<string, unknown>).__FSDX_AI_PROVIDERS__ = undefined;
	mockOpenaiCompatible.mockClear();
	mockOpenaiCompatible.mockImplementation(() => vi.fn());
});

describe("readProviders", () => {
	it("配置为空/非法 JSON/非数组时降级为空数组", async () => {
		mockGetConfig.mockResolvedValue("");
		expect(await readProviders()).toEqual([]);

		mockGetConfig.mockResolvedValue("not-json");
		expect(await readProviders()).toEqual([]);

		mockGetConfig.mockResolvedValue("{}");
		expect(await readProviders()).toEqual([]);
	});

	it("合法 JSON 数组解析为厂商列表", async () => {
		mockGetConfig.mockResolvedValue(JSON.stringify(PROVIDERS));
		expect(await readProviders()).toEqual(PROVIDERS);
	});

	it("单项非法时跳过并保留合法项（不影响其它厂商）", async () => {
		const broken = [
			{ id: "bad", name: "", baseUrl: "x", apiKey: "y", model: "z" }, // name 为空 → 非法
			PROVIDERS[0]!,
			PROVIDERS[1]!,
		];
		mockGetConfig.mockResolvedValue(JSON.stringify(broken));
		const result = await readProviders();
		expect(result).toHaveLength(2);
		expect(result.map((p) => p.id)).toEqual(["deepseek", "moonshot"]);
	});
});

describe("resolveProvider", () => {
	it("按 providerId 命中", () => {
		expect(resolveProvider(PROVIDERS, "moonshot")?.id).toBe("moonshot");
	});

	it("无 providerId 时命中 default", () => {
		expect(resolveProvider(PROVIDERS)?.id).toBe("deepseek");
	});

	it("无 default 时取首个非空", () => {
		const [a, b] = PROVIDERS;
		const list = [{ ...a!, default: false }, b!];
		expect(resolveProvider(list)?.id).toBe("deepseek");
	});

	it("providerId 未命中返回 null", () => {
		expect(resolveProvider(PROVIDERS, "nope")).toBeNull();
	});

	it("全部缺少关键字段时返回 null", () => {
		const broken = [
			{ id: "x", name: "x", baseUrl: "", apiKey: "", model: "" },
		] as AiProviderConfig[];
		expect(resolveProvider(broken)).toBeNull();
	});
});

describe("readProviderConfig", () => {
	it("读取并解析目标厂商配置", async () => {
		setConfig(PROVIDERS);
		expect((await readProviderConfig("moonshot"))?.id).toBe("moonshot");
		expect((await readProviderConfig())?.id).toBe("deepseek");
	});
});

describe("getAiProvider", () => {
	it("按目标厂商构建 openaiCompatible 并按「id+指纹」缓存", async () => {
		setConfig(PROVIDERS);
		const provider = await getAiProvider("moonshot");
		expect(provider).not.toBeNull();
		expect(mockOpenaiCompatible).toHaveBeenCalledTimes(1);
		expect(mockOpenaiCompatible).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: "https://api.moonshot.ai/v1",
				apiKey: "sk-ms",
				models: ["kimi-k2-0711-preview"],
			}),
		);

		// 同厂商同配置再次调用不重建
		await getAiProvider("moonshot");
		expect(mockOpenaiCompatible).toHaveBeenCalledTimes(1);

		// 不同厂商各自独立构建
		await getAiProvider("deepseek");
		expect(mockOpenaiCompatible).toHaveBeenCalledTimes(2);
	});

	it("配置变更时按指纹重建", async () => {
		setConfig(PROVIDERS);
		await getAiProvider("deepseek");
		setConfig([
			{ ...PROVIDERS[0]!, model: "deepseek-reasoner" },
			PROVIDERS[1]!,
		]);
		await getAiProvider("deepseek");
		expect(mockOpenaiCompatible).toHaveBeenCalledTimes(2);
	});

	it("无可命中厂商时返回 null", async () => {
		mockGetConfig.mockResolvedValue("[]");
		expect(await getAiProvider()).toBeNull();
	});
});

describe("getAiAdapter", () => {
	it("用目标厂商的模型名调用 provider 返回 adapter", async () => {
		setConfig(PROVIDERS);
		const provider = vi.fn(() => ({ kind: "text" }));
		mockOpenaiCompatible.mockReturnValue(provider);

		const adapter = await getAiAdapter("moonshot");
		expect(adapter).toEqual({ kind: "text" });
		expect(provider).toHaveBeenCalledWith("kimi-k2-0711-preview");
	});

	it("未配置时返回 null", async () => {
		mockGetConfig.mockResolvedValue("[]");
		expect(await getAiAdapter()).toBeNull();
	});
});
