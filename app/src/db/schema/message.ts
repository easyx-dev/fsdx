/**
 * 通用消息表：管理端与客户端用户消息
 * 通过 recipientType + recipientId 定位接收者（无外键，仿 operation_log 的 operator_id 模式）
 */
import {
	index,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

/** 消息接收者类型 */
export type MessageRecipientType = "admin" | "client";

/** 消息状态 */
export type MessageStatus = "unread" | "read";

export const message = pgTable(
	"message",
	{
		id: uuid().defaultRandom().primaryKey(),
		recipientType: varchar("recipient_type", { length: 20 })
			.$type<MessageRecipientType>()
			.notNull(),
		recipientId: uuid("recipient_id").notNull(),
		title: varchar({ length: 200 }).notNull(),
		content: text(),
		type: varchar({ length: 50 }).default("system").notNull(),
		status: varchar({ length: 20 })
			.$type<MessageStatus>()
			.default("unread")
			.notNull(),
		relatedLink: varchar("related_link", { length: 500 }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => [
		index("idx_message_recipient").on(table.recipientType, table.recipientId),
	],
);
