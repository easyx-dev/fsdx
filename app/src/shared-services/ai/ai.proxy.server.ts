/**
 * AI 对话 OpenAI 兼容代理（app 服务层）
 * 把编辑器宿主的接入面收敛到最小：入参为 OpenAI Chat Completions 请求体（`{ messages, stream }`），
 * 出参为**原样透传**的厂商 SSE —— 供 @easyx/ai-rich-editor 的 chat 字符串模式消费。
 * 与 ai.server.ts 的 TanStack AI 编排是两条并存路径：这里只做「鉴权后的直通」，不解析增量，
 * 因此推理内容（reasoning_content）、finish_reason、usage 均保持厂商原始形态。
 */
import type OpenAI from "openai";
import { z } from "zod";
import {
	isAbortError,
	logExternalRequest,
	observeExternalStream,
} from "#/shared-services/external-observability";
import { getAiRawClient } from "./ai.provider";

/** 传入的对话消息内容块：文本或厂商原生的多模态块，按原样转发故只校验容器形态 */
const chatContentPartSchema = z.record(z.string(), z.unknown());

/** OpenAI Chat Completions 请求体（仅收窄到代理所需的字段） */
export const openAiChatRequestSchema = z.object({
	messages: z
		.array(
			z.object({
				role: z.enum(["system", "user", "assistant"]),
				content: z.union([z.string(), z.array(chatContentPartSchema)]),
			}),
		)
		.min(1),
	stream: z.boolean().optional(),
});

export type OpenAiChatRequest = z.infer<typeof openAiChatRequestSchema>;

/** OpenAI 兼容错误体：客户端按 `error.message` 读取文案 */
export function openAiErrorResponse(status: number, message: string): Response {
	return new Response(JSON.stringify({ error: { message } }), {
		status,
		headers: { "content-type": "application/json; charset=utf-8" },
	});
}

const sseEncoder = new TextEncoder();

/**
 * 把 OpenAI 流式增量编码为 SSE：逐块 `data: {chunk}\n\n`，正常结束补 `data: [DONE]`。
 * 客户端以 `[DONE]` 或 `finish_reason` 判定收尾，两者都缺失会视为流被切断，故必须补终止哨兵。
 */
export function encodeOpenAiSseStream(
	stream: AsyncIterable<unknown>,
): ReadableStream<Uint8Array> {
	const iterator = stream[Symbol.asyncIterator]();
	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			try {
				const { value, done } = await iterator.next();
				if (done) {
					controller.enqueue(sseEncoder.encode("data: [DONE]\n\n"));
					controller.close();
					return;
				}
				controller.enqueue(
					sseEncoder.encode(`data: ${JSON.stringify(value)}\n\n`),
				);
			} catch (err) {
				// 响应头已发出，错误只能以流内事件收尾（客户端解析后抛出）；
				// 客户端已断开时流可能已关闭，收尾动作需容错
				try {
					const message = err instanceof Error ? err.message : String(err);
					controller.enqueue(
						sseEncoder.encode(
							`data: ${JSON.stringify({ error: { message } })}\n\n`,
						),
					);
					controller.close();
				} catch {
					// 流已取消，无需收尾
				}
			}
		},
		async cancel() {
			await iterator.return?.();
		},
	});
}

/** 代理入参 */
export interface AiProxyParams {
	/** 完整对话历史（system 已由客户端置于首位） */
	messages: OpenAiChatRequest["messages"];
	/** 目标厂商 ID（可选，缺省用默认厂商） */
	providerId?: string;
	/** 目标模型 ID（可选，缺省用厂商默认模型） */
	modelId?: string;
	/** 取消信号（客户端停止 / 断开时终止上游请求） */
	signal?: AbortSignal;
}

/**
 * 把一次对话请求直通给目标厂商并原样回传 OpenAI SSE。
 * 无可命中厂商 / 模型时返回 4xx JSON（便于客户端展示原文案），上游请求失败返回 502。
 */
export async function proxyOpenAiChat(
	params: AiProxyParams,
): Promise<Response> {
	const ready = await getAiRawClient(params.providerId, params.modelId);
	if (!ready) {
		return openAiErrorResponse(
			503,
			"AI 客户端未配置，请检查 ai_providers 配置",
		);
	}

	let stream: AsyncIterable<unknown>;
	// 建立流失败的耗时为「发起 → 抛错」；流建立成功后的整段耗时由流观测器在流结束处记录
	const startedAt = Date.now();
	try {
		stream = await ready.client.chat.completions.create(
			{
				model: ready.model,
				messages:
					params.messages as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
				stream: true,
			},
			{ signal: params.signal },
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : "上游 AI 请求失败";
		// 建立流失败：客户端主动中止不算上游故障（口径与流内失败一致）
		if (!isAbortError(err)) {
			logExternalRequest({
				system: "ai",
				requestType: "business",
				path: "chat/completions",
				method: "POST",
				duration: Date.now() - startedAt,
				success: false,
				error: message,
				extra: { providerId: params.providerId, model: ready.model },
			});
		}
		return openAiErrorResponse(502, message);
	}

	return new Response(
		encodeOpenAiSseStream(
			observeExternalStream(stream, {
				system: "ai",
				requestType: "business",
				path: "chat/completions",
				method: "POST",
				extra: { providerId: params.providerId, model: ready.model },
			}),
		),
		{
			headers: {
				"content-type": "text/event-stream; charset=utf-8",
				"cache-control": "no-cache, no-transform",
				// 关闭 nginx 等反向代理的响应缓冲，保证增量实时到达
				"x-accel-buffering": "no",
			},
		},
	);
}
