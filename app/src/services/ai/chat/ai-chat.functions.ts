/**
 * 通用 AI 流式对话 Server Function
 * 返回 ReadableStream<Uint8Array>（SSE 帧字节流），由 TanStack Start 原始流协议透传；
 * 客户端直接 getReader/sseStream 消费，无需自建 HTTP 端点。
 * 通用能力：任意 OpenAI 兼容业务（AI 富编辑器、摘要、翻译等）复用，
 * 业务差异仅体现于 systemPrompt 与历史，由调用方组装透传。
 */
import { getRequestOperator } from "@fsdx/core/request-context";
import { createServerFn } from "@tanstack/react-start";
import { adminPermGuard } from "#/middleware/admin-auth";
import { ADMIN_PERMISSIONS } from "#/permissions/admin-permissions";
import { logOperation } from "#/services/operation-log/operation-log.server";
import { aiChatSchema } from "./ai-chat.schemas";
import { type AiChatStreamCallbacks, streamAiChat } from "./ai-chat.server";

/** 编码 SSE 帧：data 多行分别加前缀，保证 token 中的换行不破坏分帧 */
function formatSseEvent(event: string, data: string): string {
	const lines = data.split(/\r?\n/).map((line) => `data: ${line}`);
	return `event: ${event}\n${lines.join("\n")}\n\n`;
}

/** 编码 JSON 载荷事件 */
function encodeJsonEvent(
	controller: ReadableStreamDefaultController<Uint8Array>,
	encoder: TextEncoder,
	event: string,
	payload: unknown,
): void {
	controller.enqueue(
		encoder.encode(formatSseEvent(event, JSON.stringify(payload))),
	);
}

/** 通用 AI 对话 Server Function（流式 SSE） */
export const aiChatSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(ADMIN_PERMISSIONS.AI_CHAT)])
	.validator(aiChatSchema)
	.handler(async ({ data }) => {
		// 审计：发起一次 AI 生成（fire-and-forget，操作人由鉴权中间件注入 ALS）
		const operator = getRequestOperator();
		logOperation({
			operatorId: operator.id,
			operatorName: operator.username ?? operator.id ?? "unknown",
			module: "ai-chat",
			action: "chat",
			targetType: "ai-chat",
			targetName: data.options?.model ?? undefined,
			detail: { messageCount: data.messages.length },
		});

		const encoder = new TextEncoder();
		return new ReadableStream<Uint8Array>({
			async start(controller) {
				const callbacks: AiChatStreamCallbacks = {
					onToken: (delta) => {
						controller.enqueue(encoder.encode(formatSseEvent("delta", delta)));
					},
					onThinking: (delta) => {
						controller.enqueue(
							encoder.encode(formatSseEvent("thinking", delta)),
						);
					},
					onAttemptChange: (type) => {
						encodeJsonEvent(controller, encoder, "attempt", {
							model: type,
						});
					},
				};
				try {
					const result = await streamAiChat(
						{
							messages: data.messages,
							systemPrompt: data.systemPrompt,
							temperature: data.temperature,
							maxTokens: data.options?.maxTokens,
						},
						callbacks,
					);
					encodeJsonEvent(controller, encoder, "done", {
						model: result.model,
						usage: result.usage ?? undefined,
						content: result.content,
					});
				} catch (err) {
					const message = err instanceof Error ? err.message : "AI 生成失败";
					encodeJsonEvent(controller, encoder, "error", { message });
				} finally {
					controller.close();
				}
			},
		});
	});
