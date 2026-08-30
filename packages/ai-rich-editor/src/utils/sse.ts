/**
 * 轻量 SSE 解析：帧拆解（纯函数）与流消费
 * 不引入第三方 SSE 库，供适配器实现（如转发 OpenAI/宿主端点）复用
 */
import type { AiChatUsage } from "../types";

/** 单个 SSE 帧 */
export interface SseFrame {
	/** 事件类型，缺省为 message */
	event: string;
	/** data 载荷（多行 data 以换行合并） */
	data: string;
}

/** 帧数据为空时的事件类型 */
export const SSE_EVENT_DELTA = "delta";
export const SSE_EVENT_DONE = "done";
export const SSE_EVENT_ERROR = "error";
export const SSE_EVENT_ATTEMPT = "attempt";
export const SSE_EVENT_THINKING = "thinking";

/** done 事件载荷 */
export interface SseDonePayload {
	model: string;
	usage?: AiChatUsage;
	content: string;
}

/**
 * 从累积缓冲中拆出完整帧
 * @returns frames 完整帧列表；rest 残留的不完整缓冲
 */
export function extractSseFrames(buffer: string): {
	frames: SseFrame[];
	rest: string;
} {
	const frames: SseFrame[] = [];
	let rest = buffer;
	while (true) {
		const separator = searchFrameSeparator(rest);
		if (separator.start < 0) break;
		const frameText = rest.slice(0, separator.start);
		rest = rest.slice(separator.end);
		const frame = parseSseFrame(frameText);
		if (frame) frames.push(frame);
	}
	return { frames, rest };
}

/** 查找帧分隔符（\n\n 或 \r\n\r\n），返回起始/结束位置 */
function searchFrameSeparator(text: string): { start: number; end: number } {
	const lf = text.indexOf("\n\n");
	const crlf = text.indexOf("\r\n\r\n");
	if (lf === -1 && crlf === -1) return { start: -1, end: -1 };
	if (crlf === -1 || (lf !== -1 && lf < crlf)) {
		return { start: lf, end: lf + 2 };
	}
	return { start: crlf, end: crlf + 4 };
}

/** 解析一段帧文本为结构化事件（忽略注释行；无 data 的帧视为空事件返回 null） */
export function parseSseFrame(frameText: string): SseFrame | null {
	let event = "message";
	const dataLines: string[] = [];
	for (const line of frameText.split(/\r?\n/)) {
		if (line.startsWith(":")) continue; // 注释行
		if (line.startsWith("event:")) {
			event = line.slice(6).trim();
		} else if (line.startsWith("data:")) {
			// SSE 规范：data: 后紧跟一个空格才剥离该空格，缩进内容保留
			const raw = line.slice(5);
			dataLines.push(raw.startsWith(" ") ? raw.slice(1) : raw);
		}
	}
	if (dataLines.length === 0) return null;
	return { event, data: dataLines.join("\n") };
}

/**
 * 读取 Web ReadableStream 并逐帧回调
 * 自动处理多字节 UTF-8 分片；done 时冲刷解码缓冲
 */
export async function consumeSseStream(
	body: ReadableStream<Uint8Array>,
	onFrame: (frame: SseFrame) => void,
	signal?: AbortSignal,
): Promise<void> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	const abortHandler = () => {
		void reader.cancel();
	};
	if (signal) signal.addEventListener("abort", abortHandler);
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			const { frames, rest } = extractSseFrames(buffer);
			buffer = rest;
			for (const frame of frames) onFrame(frame);
		}
		// 冲刷解码器可能残留的多字节尾部
		buffer += decoder.decode();
		const tail = extractSseFrames(buffer);
		for (const frame of tail.frames) onFrame(frame);
	} finally {
		if (signal) signal.removeEventListener("abort", abortHandler);
	}
}

/**
 * 以异步迭代器形式消费 SSE 流（适配器 for await 友好）
 * 正常结束冲刷尾部缓冲；abort 时取消底层读取，主动退出时清理监听
 */
export async function* sseStream(
	body: ReadableStream<Uint8Array>,
	signal?: AbortSignal,
): AsyncGenerator<SseFrame, void, unknown> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	let finished = false;
	const abortHandler = () => {
		void reader.cancel();
	};
	if (signal?.aborted) abortHandler();
	else signal?.addEventListener("abort", abortHandler);
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				finished = true;
				break;
			}
			buffer += decoder.decode(value, { stream: true });
			const { frames, rest } = extractSseFrames(buffer);
			buffer = rest;
			for (const frame of frames) yield frame;
		}
		buffer += decoder.decode();
		const tail = extractSseFrames(buffer);
		for (const frame of tail.frames) yield frame;
	} finally {
		signal?.removeEventListener("abort", abortHandler);
		if (!finished) void reader.cancel();
	}
}
