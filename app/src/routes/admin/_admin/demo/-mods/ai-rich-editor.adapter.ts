/**
 * AiRichEditor 宿主适配器（app 示例实现）
 * 通过 @fsdx/ai-rich-editor 的 AiChatAdapter 契约，消费通用 aiChatSFn 的流式 ReadableStream
 * system 提示词由组件包生成并经请求透传，此处不做提示词组装
 */
import type {
	AiChatAdapter,
	AiChatChunk,
	AiChatUsage,
} from "@fsdx/ai-rich-editor";
import {
	SSE_EVENT_DELTA,
	SSE_EVENT_DONE,
	SSE_EVENT_ERROR,
	SSE_EVENT_THINKING,
	sseStream,
} from "@fsdx/ai-rich-editor/sse";
import { aiChatSFn } from "#/services/ai/chat/ai-chat.functions";

/** 解析 JSON 载荷，解析失败返回 null */
function parseJson<T>(raw: string): T | null {
	try {
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

/** done 帧载荷 */
interface DonePayload {
	model: string;
	usage?: AiChatUsage;
}

export const aiRichEditorAdapter: AiChatAdapter = async function* (
	request,
	signal,
): AsyncGenerator<AiChatChunk, void, unknown> {
	const stream = await aiChatSFn({
		data: {
			messages: request.messages,
			systemPrompt: request.systemPrompt,
			temperature: request.options?.temperature,
			options: {
				maxTokens: request.options?.maxTokens,
				model: request.options?.model,
			},
		},
	});

	for await (const frame of sseStream(stream, signal)) {
		if (frame.event === SSE_EVENT_DELTA) {
			yield { type: "delta", text: frame.data };
		} else if (frame.event === SSE_EVENT_THINKING) {
			yield { type: "thinking", text: frame.data };
		} else if (frame.event === SSE_EVENT_DONE) {
			const payload = parseJson<DonePayload>(frame.data);
			yield {
				type: "done",
				model: payload?.model ?? "unknown",
				usage: payload?.usage,
			};
		} else if (frame.event === SSE_EVENT_ERROR) {
			const payload = parseJson<{ message?: string }>(frame.data);
			yield { type: "error", message: payload?.message ?? "AI 生成失败" };
		}
	}
};
