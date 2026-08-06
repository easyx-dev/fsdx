/**
 * AI 模型测试 Server Function
 */

import { type ChatMessage, deepChat, fastChat } from "@fsdx/core/ai";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminPermGuard } from "#/middleware/admin-auth";
import { ADMIN_PERMISSIONS } from "#/permissions/admin-permissions";

export const aiTestSchema = z.object({
	modelType: z.enum(["deep", "fast"]),
	systemMessage: z.string().optional(),
	userMessage: z.string().min(1, "请输入消息内容"),
	temperature: z.number().min(0).max(2).default(0.7),
	maxTokens: z.number().int().min(1).max(16384).optional(),
});

export const aiTestSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(ADMIN_PERMISSIONS.AI_TEST)])
	.inputValidator(aiTestSchema)
	.handler(async ({ data }) => {
		const messages: ChatMessage[] = [];
		if (data.systemMessage) {
			messages.push({ role: "system", content: data.systemMessage });
		}
		messages.push({ role: "user", content: data.userMessage });

		const chatFn = data.modelType === "deep" ? deepChat : fastChat;
		return chatFn(messages, {
			temperature: data.temperature,
			maxTokens: data.maxTokens,
		});
	});
