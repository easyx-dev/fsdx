/**
 * useAiChat 对话状态 hook 测试：流式消费、思考累积、deep→fast 降级清空、失败提示
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AiChatAdapter, AiChatChunk, AiChatMode } from "../../types";
import { useAiChat } from "../useAiChat";

/** 按给定 chunk 序列产出对话流的 mock 适配器 */
function adapterFrom(chunks: AiChatChunk[]): AiChatAdapter {
	return async function* () {
		for (const chunk of chunks) yield chunk;
	};
}

/** 渲染 hook 并发送一条消息，等待流结束后返回 controller */
async function runChat(chunks: AiChatChunk[]) {
	const adapter = adapterFrom(chunks);
	const { result } = renderHook(() =>
		useAiChat({
			currentHtml: "<div>旧</div>",
			adapter,
			mode: "fragment" as AiChatMode,
			systemPrompt: "你是助手",
		}),
	);
	await act(async () => {
		await result.current.send("生成页面");
	});
	return result;
}

describe("useAiChat", () => {
	it("正常流：累积正文与思考，保存 assistant 消息并触发完成回调", async () => {
		const onComplete = vi.fn();
		const adapter = adapterFrom([
			{ type: "thinking", text: "先分析需求" },
			{ type: "delta", text: "<div>" },
			{ type: "delta", text: "内容</div>" },
			{ type: "done", model: "deep-model", usage: undefined },
		]);
		const { result } = renderHook(() =>
			useAiChat({
				currentHtml: "",
				adapter,
				mode: "fragment",
				systemPrompt: "sys",
				onComplete,
			}),
		);
		await act(async () => {
			await result.current.send("hi");
		});
		const assistant = result.current.messages.at(-1);
		expect(assistant?.role).toBe("assistant");
		expect(assistant?.content).toBe("<div>内容</div>");
		expect(assistant?.thinking).toBe("先分析需求");
		expect(onComplete).toHaveBeenCalledWith("<div>内容</div>");
	});

	it("attempt 降级：清空已输出的正文与思考，最终只保留 fast 的完整结果", async () => {
		const result = await runChat([
			{ type: "thinking", text: "deep 已开始的思考" },
			{ type: "delta", text: "deep 已输出的残文" },
			{ type: "attempt", model: "fast" },
			{ type: "delta", text: "fast 完整正文" },
			{ type: "done", model: "fast", usage: undefined },
		]);
		const assistant = result.current.messages.at(-1);
		expect(assistant?.role).toBe("assistant");
		// 正文只含 fast 结果，deep 残文被清空
		expect(assistant?.content).toBe("fast 完整正文");
		expect(assistant?.content).not.toContain("deep 已输出的残文");
		// 思考也被清空
		expect(assistant?.thinking).toBeUndefined();
	});

	it("error 帧：不保存 assistant 消息并暴露错误", async () => {
		const result = await runChat([{ type: "error", message: "模型超时" }]);
		expect(result.current.messages.length).toBe(1); // 仅用户消息，无 assistant
		expect(result.current.error).toBe("模型超时");
	});

	it("clear 后由 abort 触发的 catch 不残留「已停止生成」错误", async () => {
		// 流式开始后立即清空：messages 已同步清空，abort 的 catch 分支应跳过错误提示
		const adapter = adapterFrom([{ type: "delta", text: "部分输出" }]);
		const { result } = renderHook(() =>
			useAiChat({ currentHtml: "", adapter, mode: "fragment" }),
		);
		// 先触发一次 send，让 controller 持有 abort
		const sendPromise = act(async () => {
			const p = result.current.send("hi");
			result.current.clear();
			await p;
		});
		await sendPromise;
		expect(result.current.error).toBeNull();
	});
});
