/**
 * AI 对话流式端点（Server Route）
 * URL: /api/ai-chat[?providerId=xxx]
 * OpenAI Chat Completions 兼容：入参 `{ messages, stream }`，出参厂商原始 SSE（含 `data: [DONE]`）。
 * 供 @easyx/ai-rich-editor（chat 字符串模式）消费；鉴权：管理端 AI_CHAT 权限；审计：每次生成写入操作日志。
 */

import { createFileRoute } from "@tanstack/react-router";
import { adminPermRouteGuard } from "#/middleware/admin-auth";
import { ADMIN_PERMISSIONS } from "#/permissions/admin-permissions";
import {
	openAiChatRequestSchema,
	openAiErrorResponse,
	proxyOpenAiChat,
} from "#/shared-services/ai/ai.proxy.server";
import { logOperation } from "#/shared-services/operation-log/operation-log.server";
import { getRequestOperator } from "#/shared-services/request-context";

export const Route = createFileRoute("/api/ai-chat")({
	server: {
		middleware: [adminPermRouteGuard(ADMIN_PERMISSIONS.AI_CHAT)],
		handlers: {
			POST: async ({ request }) => {
				const body: unknown = await request.json().catch(() => undefined);
				const parsed = openAiChatRequestSchema.safeParse(body);
				if (!parsed.success) {
					return openAiErrorResponse(
						400,
						"请求体不是合法的 OpenAI Chat Completions 格式",
					);
				}

				// 厂商选择经查询串透传（OpenAI 协议体不携带该信息），缺省用默认厂商
				const providerId =
					new URL(request.url).searchParams.get("providerId") || undefined;

				// 审计：发起一次 AI 生成（fire-and-forget，操作人由鉴权中间件注入 ALS）
				const operator = getRequestOperator();
				logOperation({
					operatorId: operator.id,
					operatorName: operator.username ?? operator.id ?? "unknown",
					module: "ai-chat",
					action: "chat",
					targetType: "ai-chat",
					detail: { messageCount: parsed.data.messages.length, providerId },
				});

				return proxyOpenAiChat({
					messages: parsed.data.messages,
					providerId,
					signal: request.signal,
				});
			},
		},
	},
});
