/**
 * AI 模型测试 Server Function（单模型）
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminPermGuard } from "#/middleware/admin-auth";
import { ADMIN_PERMISSIONS } from "#/permissions/admin-permissions";
import { completeText } from "#/services/ai/ai.server";

export const aiTestSchema = z.object({
	systemMessage: z.string().optional(),
	userMessage: z.string().min(1, "请输入消息内容"),
	providerId: z.string().optional(),
	temperature: z.number().min(0).max(2).default(0.7),
	maxTokens: z.number().int().min(1).max(16384).optional(),
});

export const aiTestSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(ADMIN_PERMISSIONS.AI_TEST)])
	.validator(aiTestSchema)
	.handler(async ({ data }) => {
		const modelOptions: Record<string, unknown> = {
			temperature: data.temperature,
		};
		if (data.maxTokens !== undefined) {
			modelOptions.max_tokens = data.maxTokens;
		}

		return completeText({
			messages: [{ role: "user", content: data.userMessage }],
			systemPrompts: data.systemMessage ? [data.systemMessage] : undefined,
			providerId: data.providerId,
			modelOptions,
		});
	});
