/**
 * 通用 AI 流式对话 Chat Schema 校验测试
 */
import { describe, expect, it } from "vitest";
import { aiChatMessageSchema, aiChatSchema } from "../ai-chat.schemas";

describe("aiChatMessageSchema", () => {
	it("接受合法消息并裁剪多余字段", () => {
		const result = aiChatMessageSchema.safeParse({
			role: "user",
			content: "生成一个页面",
			extra: "被剔除",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual({ role: "user", content: "生成一个页面" });
		}
	});

	it("拒绝非法角色", () => {
		expect(
			aiChatMessageSchema.safeParse({ role: "system", content: "x" }).success,
		).toBe(false);
	});

	it("拒绝空内容与超长内容", () => {
		expect(
			aiChatMessageSchema.safeParse({ role: "user", content: "" }).success,
		).toBe(false);
		expect(
			aiChatMessageSchema.safeParse({
				role: "user",
				content: "x".repeat(20001),
			}).success,
		).toBe(false);
	});
});

/** 合法请求构造（systemPrompt 必填） */
function buildValidRequest(overrides: Record<string, unknown> = {}) {
	return {
		messages: [{ role: "user" as const, content: "hi" }],
		systemPrompt: "你是助手",
		...overrides,
	};
}

describe("aiChatSchema", () => {
	it("接受合法请求，options 可缺省", () => {
		const result = aiChatSchema.safeParse(buildValidRequest());
		expect(result.success).toBe(true);
	});

	it("缺省 systemPrompt 时拒绝", () => {
		const result = aiChatSchema.safeParse({
			messages: [{ role: "user", content: "hi" }],
		});
		expect(result.success).toBe(false);
	});

	it("拒绝空 messages 与超出上限条数", () => {
		expect(
			aiChatSchema.safeParse(buildValidRequest({ messages: [] })).success,
		).toBe(false);
		const many = Array.from({ length: 51 }, () => ({
			role: "user" as const,
			content: "x",
		}));
		expect(
			aiChatSchema.safeParse(buildValidRequest({ messages: many })).success,
		).toBe(false);
	});

	it("接受合法温度、maxTokens 与 model 选项", () => {
		const result = aiChatSchema.safeParse(
			buildValidRequest({
				temperature: 0.3,
				options: { maxTokens: 2048, model: "gpt-4o" },
			}),
		);
		expect(result.success).toBe(true);
	});

	it("拒绝越界温度与越界 maxTokens", () => {
		expect(
			aiChatSchema.safeParse(buildValidRequest({ temperature: 3 })).success,
		).toBe(false);
		expect(
			aiChatSchema.safeParse(buildValidRequest({ options: { maxTokens: 0 } }))
				.success,
		).toBe(false);
	});
});
