/**
 * AI 对话流式端点（Server Route）
 * URL: /api/ai-chat
 * 供 @fsdx/ai-rich-editor（useChat + fetchServerSentEvents）消费；返回 TanStack AI 标准 SSE。
 * 鉴权：管理端 AI_CHAT 权限；审计：每次生成写入操作日志。
 */

import { getRequestOperator } from "@fsdx/core/request-context";
import {
	chatParamsFromRequest,
	toServerSentEventsResponse,
} from "@tanstack/ai";
import { createFileRoute } from "@tanstack/react-router";
import { adminPermRouteGuard } from "#/middleware/admin-auth";
import { ADMIN_PERMISSIONS } from "#/permissions/admin-permissions";
import { streamAiChat } from "#/services/ai/ai.server";
import { logOperation } from "#/services/operation-log/operation-log.server";

export const Route = createFileRoute("/api/ai-chat")({
	server: {
		middleware: [adminPermRouteGuard(ADMIN_PERMISSIONS.AI_CHAT)],
		handlers: {
			POST: async ({ request }) => {
				// 解析 AG-UI 请求体（useChat 发出），失败由框架转 400
				const params = await chatParamsFromRequest(request);
				// system 提示词 / 厂商选择由客户端经 sendMessage(text, { body }) 透传进 forwardedProps
				const systemPrompt = params.forwardedProps?.systemPrompt as
					| string
					| undefined;
				const providerId = params.forwardedProps?.providerId as
					| string
					| undefined;

				// 审计：发起一次 AI 生成（fire-and-forget，操作人由鉴权中间件注入 ALS）
				const operator = getRequestOperator();
				logOperation({
					operatorId: operator.id,
					operatorName: operator.username ?? operator.id ?? "unknown",
					module: "ai-chat",
					action: "chat",
					targetType: "ai-chat",
					detail: { messageCount: params.messages.length },
				});

				const stream = await streamAiChat({
					messages: params.messages,
					systemPrompts: systemPrompt ? [systemPrompt] : undefined,
					providerId,
					threadId: params.threadId,
					runId: params.runId,
				});

				return toServerSentEventsResponse(stream);
			},
		},
	},
});
