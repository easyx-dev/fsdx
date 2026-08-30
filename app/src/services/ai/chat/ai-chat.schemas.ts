/**
 * 通用 AI 流式对话 Chat Schema：任意 OpenAI 兼容业务复用的入参校验（单一来源）
 * 业务语义（输出形态、提示词模板）由调用方经 systemPrompt 承载，此处不做业务假设
 */
import { z } from "zod";

/** 单条对话消息（不含 system，system 由调用方经 systemPrompt 传入） */
export const aiChatMessageSchema = z.object({
	role: z.enum(["user", "assistant"]),
	/** 单条消息上限 2 万字符，防极端输入撑爆上下文 */
	content: z.string().min(1).max(20000),
});

export type AiChatMessageInput = z.infer<typeof aiChatMessageSchema>;

/** 通用 AI 对话请求体 */
export const aiChatSchema = z.object({
	/** 完整对话历史（按时间顺序，调用方负责裁剪） */
	messages: z.array(aiChatMessageSchema).min(1).max(50),
	/** system 提示词（由调用方组装并透传，上限防超长） */
	systemPrompt: z.string().min(1).max(8000),
	/** 温度（可选，缺省交给模型默认值） */
	temperature: z.number().min(0).max(2).optional(),
	/** 其他可透传选项 */
	options: z
		.object({
			/** 最大输出 token 数（可选，缺省用服务层通用默认） */
			maxTokens: z.number().int().min(1).max(16384).optional(),
			/** 指定模型（可选，通常由服务端配置决定，仅作覆盖） */
			model: z.string().max(200).optional(),
		})
		.optional(),
});

export type AiChatInput = z.infer<typeof aiChatSchema>;
