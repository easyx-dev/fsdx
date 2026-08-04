/**
 * 消息 Server Functions：客户端自助 + 管理端个人收件箱 + 管理端消息管理
 */
import { createServerFn } from "@tanstack/react-start";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminAuthGuard, adminPermGuard } from "#/middleware/admin-auth";
import { clientAuthGuard } from "#/middleware/client-auth";
import { logCrud } from "#/services/operation-log/operation-log.server";
import {
	adminMessageListSchema,
	messageIdSchema,
	messageListSchema,
	searchRecipientsSchema,
	sendMessageSchema,
} from "./message.schemas";
import {
	deleteMessage,
	deleteMessageById,
	getMessages,
	getUnreadCount,
	listMessages,
	markAllRead,
	markAsRead,
	searchRecipients,
	sendMessages,
} from "./message.server";

// ═══════════════════════════════════════════════════
// 客户端用户自助（登录即可，操作自己的消息）
// ═══════════════════════════════════════════════════

/** 分页查询自己的消息 */
export const getMyMessagesSFn = createServerFn({ method: "GET" })
	.middleware([clientAuthGuard])
	.inputValidator(messageListSchema)
	.handler(async ({ data, context }) =>
		getMessages({
			recipient: { type: "client", id: context.userId },
			status: data.status,
			page: data.page,
			pageSize: data.pageSize,
		}),
	);

/** 查询自己的未读消息数 */
export const getMyUnreadCountSFn = createServerFn({ method: "GET" })
	.middleware([clientAuthGuard])
	.handler(async ({ context }) =>
		getUnreadCount({ type: "client", id: context.userId }),
	);

/** 标记自己的一条消息为已读 */
export const markMyMessageAsReadSFn = createServerFn({ method: "POST" })
	.middleware([clientAuthGuard])
	.inputValidator(messageIdSchema)
	.handler(async ({ data, context }) => {
		const ok = await markAsRead(data.id, {
			type: "client",
			id: context.userId,
		});
		return { success: ok };
	});

/** 标记自己的全部未读消息为已读 */
export const markAllMyMessagesAsReadSFn = createServerFn({ method: "POST" })
	.middleware([clientAuthGuard])
	.handler(async ({ context }) => {
		const count = await markAllRead({ type: "client", id: context.userId });
		return { count };
	});

/** 删除自己的一条消息 */
export const deleteMyMessageSFn = createServerFn({ method: "POST" })
	.middleware([clientAuthGuard])
	.inputValidator(messageIdSchema)
	.handler(async ({ data, context }) => {
		const ok = await deleteMessage(data.id, {
			type: "client",
			id: context.userId,
		});
		return { success: ok };
	});

// ═══════════════════════════════════════════════════
// 管理端个人收件箱（登录即可，操作自己的消息）
// ═══════════════════════════════════════════════════

/** 分页查询自己的消息 */
export const getAdminMessagesSFn = createServerFn({ method: "GET" })
	.middleware([adminAuthGuard])
	.inputValidator(messageListSchema)
	.handler(async ({ data, context }) =>
		getMessages({
			recipient: { type: "admin", id: context.user.id },
			status: data.status,
			page: data.page,
			pageSize: data.pageSize,
		}),
	);

/** 查询自己的未读消息数 */
export const getAdminUnreadCountSFn = createServerFn({ method: "GET" })
	.middleware([adminAuthGuard])
	.handler(async ({ context }) =>
		getUnreadCount({ type: "admin", id: context.user.id }),
	);

/** 标记自己的一条消息为已读 */
export const markAdminMessageAsReadSFn = createServerFn({ method: "POST" })
	.middleware([adminAuthGuard])
	.inputValidator(messageIdSchema)
	.handler(async ({ data, context }) => {
		const ok = await markAsRead(data.id, {
			type: "admin",
			id: context.user.id,
		});
		return { success: ok };
	});

/** 标记自己的全部未读消息为已读 */
export const markAllAdminMessagesAsReadSFn = createServerFn({ method: "POST" })
	.middleware([adminAuthGuard])
	.handler(async ({ context }) => {
		const count = await markAllRead({ type: "admin", id: context.user.id });
		return { count };
	});

/** 删除自己的一条消息 */
export const deleteAdminMessageSFn = createServerFn({ method: "POST" })
	.middleware([adminAuthGuard])
	.inputValidator(messageIdSchema)
	.handler(async ({ data, context }) => {
		const ok = await deleteMessage(data.id, {
			type: "admin",
			id: context.user.id,
		});
		return { success: ok };
	});

// ═══════════════════════════════════════════════════
// 管理端消息管理（message:view / message:send / message:delete）
// ═══════════════════════════════════════════════════

/** 全量分页查询所有用户消息 */
export const listAllMessagesSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.MESSAGE_VIEW)])
	.inputValidator(adminMessageListSchema)
	.handler(async ({ data }) =>
		listMessages({
			recipientType: data.recipientType,
			status: data.status,
			type: data.type,
			keyword: data.keyword,
			page: data.page,
			pageSize: data.pageSize,
		}),
	);

/** 向用户批量发送消息 */
export const sendMessageSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.MESSAGE_SEND)])
	.inputValidator(sendMessageSchema)
	.handler(async ({ data, context }) => {
		const count = await sendMessages({ ...data });
		logCrud(
			context.user,
			"message",
			"send_message",
			{ id: data.recipientIds.join(","), name: data.title },
			{
				detail: {
					recipientType: data.recipientType,
					recipientCount: count,
				},
			},
		);
		return { count };
	});

/** 强制删除任意消息 */
export const deleteAnyMessageSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.MESSAGE_DELETE)])
	.inputValidator(messageIdSchema)
	.handler(async ({ data, context }) => {
		const ok = await deleteMessageById(data.id);
		logCrud(context.user, "message", "delete", { id: data.id });
		return { success: ok };
	});

/** 搜索消息接收者（发送消息表单的选择器数据源） */
export const searchRecipientsSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.MESSAGE_SEND)])
	.inputValidator(searchRecipientsSchema)
	.handler(async ({ data }) => searchRecipients(data));
