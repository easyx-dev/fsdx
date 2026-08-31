/**
 * SSE 帧解析与流消费测试：拆帧边界、事件解析、UTF-8 分片
 */
import { describe, expect, it, vi } from "vitest";
import {
	consumeSseStream,
	extractSseFrames,
	parseSseFrame,
	type SseFrame,
	sseStream,
} from "../utils/sse";

/** 将字符串编码为 Uint8Array */
function encode(text: string): Uint8Array {
	return new TextEncoder().encode(text);
}

/** 构造按块入队的 ReadableStream */
function makeStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
	return new ReadableStream({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(chunk);
			controller.close();
		},
	});
}

describe("extractSseFrames", () => {
	it("拆分多个连续帧并返回干净剩余缓冲", () => {
		const input = "event: delta\ndata: a\n\nevent: done\ndata: {}\n\n残留";
		const { frames, rest } = extractSseFrames(input);
		expect(frames).toEqual([
			{ event: "delta", data: "a" },
			{ event: "done", data: "{}" },
		]);
		expect(rest).toBe("残留");
	});

	it("数据不完整时不产生帧并保留缓冲", () => {
		const { frames, rest } = extractSseFrames("data: 部分");
		expect(frames).toEqual([]);
		expect(rest).toBe("data: 部分");
	});

	it("兼容空行分隔（\\r\\n\\r\\n）与注释行", () => {
		const input = ": 注释\r\n\r\nevent: delta\r\ndata: x\r\n\r\n";
		const { frames } = extractSseFrames(input);
		expect(frames).toEqual([{ event: "delta", data: "x" }]);
	});

	it("多行 data 合并为一段（还原 token 中的换行）", () => {
		const input = "event: delta\ndata: line1\ndata: line2\n\n";
		const { frames } = extractSseFrames(input);
		expect(frames).toEqual([{ event: "delta", data: "line1\nline2" }]);
	});

	it("解析 thinking 事件（reasoning 思考流，含多行）", () => {
		const input =
			"event: thinking\ndata: 先分析需求\n\nevent: thinking\ndata: 再确定布局\n\n";
		const { frames } = extractSseFrames(input);
		expect(frames).toEqual([
			{ event: "thinking", data: "先分析需求" },
			{ event: "thinking", data: "再确定布局" },
		]);
	});

	it("忽略 id 等非 data/event 行，仅保留含 data 的帧", () => {
		const { frames } = extractSseFrames("data: json\n\nid: 1\n\n");
		expect(frames).toEqual([{ event: "message", data: "json" }]);
	});
});

describe("parseSseFrame", () => {
	it("剥离 data 后的单个前导空格但保留缩进", () => {
		expect(parseSseFrame("event: delta\ndata:  <div>")?.data).toBe(" <div>");
	});
	it("无 data 行返回 null", () => {
		expect(parseSseFrame("event: delta\n: 注释")).toBeNull();
	});
});

describe("consumeSseStream", () => {
	it("跨 chunk 分片正确重组帧并回调（含 UTF-8 多字节分割）", async () => {
		// “中”的 UTF-8 为 3 字节，故意在第 2、3 字节之间断开
		const middle = "中"; // U+4E2D = e4 b8 ad
		const bytes = new TextEncoder().encode(`event: delta\ndata: ${middle}\n\n`);
		const onFrame = vi.fn();
		await consumeSseStream(
			makeStream([bytes.slice(0, 28), bytes.slice(28)]),
			onFrame,
		);
		expect(onFrame).toHaveBeenCalledTimes(1);
		expect(onFrame.mock.calls[0][0]).toEqual({
			event: "delta",
			data: middle,
		});
	});

	it("分片输入逐帧回调并完成尾部冲刷", async () => {
		const onFrame = vi.fn();
		await consumeSseStream(
			makeStream([encode("data: 123"), encode("\n\ndata: 456\n\n")]),
			onFrame,
		);
		expect(onFrame).toHaveBeenCalledTimes(2);
		expect(onFrame.mock.calls[0][0]).toEqual({
			event: "message",
			data: "123",
		});
		expect(onFrame.mock.calls[1][0]).toEqual({
			event: "message",
			data: "456",
		});
	});

	it("未以空行结束的残缺帧不产生回调（严格 SSE 语义）", async () => {
		const onFrame = vi.fn();
		await consumeSseStream(makeStream([encode("data: 123")]), onFrame);
		expect(onFrame).not.toHaveBeenCalled();
	});

	it("abort 时取消底层读取并冲刷已回调帧", async () => {
		const onCancel = vi.fn();
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encode("data: 1\n\n"));
				// 保持流打开，等待 abort 触发 cancel
				void controller;
			},
			cancel() {
				onCancel();
			},
		});
		const controller = new AbortController();
		const onFrame = vi.fn();
		const p = consumeSseStream(stream, onFrame, controller.signal);
		// 等待首帧处理完成
		await new Promise((r) => setTimeout(r, 0));
		controller.abort();
		await p.catch(() => undefined); // read 可能被拒绝，此处吞掉
		expect(onFrame).toHaveBeenCalledWith({ event: "message", data: "1" });
		expect(onCancel).toHaveBeenCalled();
	});
});

describe("sseStream", () => {
	it("以异步迭代器逐帧产出并冲刷尾部缓冲", async () => {
		const stream = makeStream([
			encode("data: 123"),
			encode("\n\ndata: 456\n\n"),
		]);
		const frames: SseFrame[] = [];
		for await (const frame of sseStream(stream)) frames.push(frame);
		expect(frames).toEqual([
			{ event: "message", data: "123" },
			{ event: "message", data: "456" },
		]);
	});

	it("abort 时取消底层读取并结束迭代", async () => {
		const onCancel = vi.fn();
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(encode("data: 1\n\n"));
				void controller;
			},
			cancel() {
				onCancel();
			},
		});
		const controller = new AbortController();
		const gen = sseStream(stream, controller.signal);
		const first = await gen.next();
		expect(first.value).toEqual({ event: "message", data: "1" });
		controller.abort();
		const second = await gen.next();
		expect(second.done).toBe(true);
		expect(onCancel).toHaveBeenCalled();
	});
});
