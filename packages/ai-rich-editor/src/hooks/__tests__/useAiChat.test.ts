/**
 * useAiChat 对话状态 hook 测试：流式消费、思考累积、deep→fast 降级清空、失败/中止、裁剪
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AiChatAdapter, AiChatChunk, AiChatRequest } from "../../types";
import { useAiChat } from "../useAiChat";

/** 按给定 chunk 序列产出对话流的 mock 适配器 */
function adapterFrom(chunks: AiChatChunk[]): AiChatAdapter {
	return async function* () {
		for (const chunk of chunks) yield chunk;
	};
}

/** 记录每次请求的 mock 适配器（用于断言裁剪与请求载荷） */
function recordingAdapter(): {
	adapter: AiChatAdapter;
	requests: AiChatRequest[];
} {
	const requests: AiChatRequest[] = [];
	const adapter: AiChatAdapter = async function* (request) {
		requests.push(request);
		yield { type: "delta", text: "ok" };
		yield { type: "done", model: "deep-model", usage: undefined };
	};
	return { adapter, requests };
}

/** 渲染 hook 并发送一条消息，等待流结束后返回 controller */
async function runChat(chunks: AiChatChunk[]) {
	const adapter = adapterFrom(chunks);
	const { result } = renderHook(() =>
		useAiChat({
			currentHtml: "<div>旧</div>",
			adapter,
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
			useAiChat({ currentHtml: "", adapter }),
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

	it("空 prompt 直接 no-op 不进入流", async () => {
		const { adapter, requests } = recordingAdapter();
		const { result } = renderHook(() =>
			useAiChat({ currentHtml: "", adapter }),
		);
		await act(async () => {
			await result.current.send("   ");
		});
		expect(result.current.messages.length).toBe(0);
		expect(requests.length).toBe(0);
	});

	it("stop 中止：适配器抛错时提示「已停止生成」并保留部分输出", async () => {
		const adapter: AiChatAdapter = async function* (_request, signal) {
			yield { type: "delta", text: "部分输出" };
			await new Promise<void>((_, reject) => {
				// 兼容：abort 可能在监听器注册前触发（已中止的 signal 不再重放事件）
				if (signal.aborted) {
					reject(new Error("aborted"));
					return;
				}
				signal.addEventListener("abort", () => reject(new Error("aborted")), {
					once: true,
				});
			});
		};
		const { result } = renderHook(() =>
			useAiChat({ currentHtml: "", adapter }),
		);
		await act(async () => {
			const p = result.current.send("hi");
			result.current.stop();
			await p;
		});
		expect(result.current.error).toBe("已停止生成");
		expect(result.current.messages.length).toBe(1); // 仅用户消息
	});

	it("done 帧记录 model 与 usage", async () => {
		const adapter = adapterFrom([
			{ type: "delta", text: "<p>hi</p>" },
			{ type: "done", model: "deepseek-chat", usage: { totalTokens: 42 } },
		]);
		const { result } = renderHook(() =>
			useAiChat({ currentHtml: "", adapter }),
		);
		await act(async () => {
			await result.current.send("hi");
		});
		expect(result.current.model).toBe("deepseek-chat");
		expect(result.current.usage).toEqual({ totalTokens: 42 });
	});

	it("超限裁剪：只保留最近 CHAT_MAX_TURNS 轮", async () => {
		const { adapter, requests } = recordingAdapter();
		const { result } = renderHook(() =>
			useAiChat({ currentHtml: "", adapter }),
		);
		for (let i = 0; i < 13; i++) {
			await act(async () => {
				await result.current.send(`第${i}条`);
			});
		}
		const lastRequest = requests.at(-1);
		expect(lastRequest?.messages.length).toBe(24);
		// 最早一轮（第0条）被裁剪，最新一条 user 保留
		expect(lastRequest?.messages.every((m) => m.content !== "第0条")).toBe(
			true,
		);
		expect(lastRequest?.messages.at(-1)).toMatchObject({
			role: "user",
			content: "第12条",
		});
	});
});
