/**
 * 消息模块 zod 校验 schema：收件箱查询、管理列表、发送、收件人搜索
 */
import { z } from "zod";

/** 消息接收者类型 */
const recipientTypeSchema = z.enum(["admin", "client"]);

/** 消息状态 */
const statusSchema = z.enum(["unread", "read"]);

/** 收件箱消息列表查询（客户端 / 管理端自助共用） */
export const messageListSchema = z.object({
	status: statusSchema.optional(),
	page: z.number().int().min(1).optional(),
	pageSize: z.number().int().min(1).max(100).optional(),
});

/** 单条消息操作（标记已读 / 删除） */
export const messageIdSchema = z.object({
	id: z.string().min(1),
});

/** 管理端全量消息列表查询 */
export const adminMessageListSchema = z.object({
	recipientType: recipientTypeSchema.optional(),
	status: statusSchema.optional(),
	type: z.string().max(50).optional(),
	keyword: z.string().max(100).optional(),
	page: z.number().int().min(1).optional(),
	pageSize: z.number().int().min(1).max(100).optional(),
});

/** 发送消息（管理端向用户批量发送） */
export const sendMessageSchema = z.object({
	recipientType: recipientTypeSchema,
	recipientIds: z.array(z.string().uuid()).min(1).max(100),
	title: z.string().min(1).max(200),
	content: z.string().max(2000).optional(),
	type: z.string().max(50).optional(),
	relatedLink: z.string().max(500).optional(),
});

/** 搜索消息接收者（发送消息表单的选择器数据源） */
export const searchRecipientsSchema = z.object({
	recipientType: recipientTypeSchema,
	keyword: z.string().max(50).optional(),
});
