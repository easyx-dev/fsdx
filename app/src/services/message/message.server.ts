/**
 * 通用消息服务层：消息创建、查询、标记已读、删除
 * 同时承载管理端与客户端用户消息，通过 recipientType + recipientId 定位接收者
 */
import { and, desc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import { db } from "#/db/index";
import {
	adminUser,
	clientUser,
	type MessageRecipientType,
	type MessageStatus,
	message,
} from "#/db/schema";
import {
	DEFAULT_PAGE,
	DEFAULT_PAGE_SIZE,
	executePaginatedQuery,
	notDeleted,
	paginationOffset,
} from "#/services/query/query-utils.server";
import type { PaginatedResult } from "#/types/query";

/** 消息接收者：管理端或客户端用户 */
export interface MessageRecipient {
	type: MessageRecipientType;
	id: string;
}

/** 创建消息参数 */
export interface CreateMessageParams {
	recipient: MessageRecipient;
	title: string;
	content?: string;
	type?: string;
	relatedLink?: string;
}

/** 收件箱查询参数 */
export interface GetMessagesParams {
	recipient: MessageRecipient;
	status?: MessageStatus;
	page?: number;
	pageSize?: number;
}

/** 管理端全量列表查询参数 */
export interface ListMessagesParams {
	recipientType?: MessageRecipientType;
	status?: MessageStatus;
	type?: string;
	keyword?: string;
	page?: number;
	pageSize?: number;
}

/** 批量发送消息参数 */
export interface SendMessagesParams {
	recipientType: MessageRecipientType;
	recipientIds: string[];
	title: string;
	content?: string;
	type?: string;
	relatedLink?: string;
}

/** 接收者候选（发送消息表单的选择器数据源） */
export interface RecipientOption {
	id: string;
	label: string;
}

/** 消息行数据 */
export type MessageRecord = typeof message.$inferSelect;

/** 消息行（含接收者名称，管理列表展示用） */
export type MessageWithRecipient = typeof message.$inferSelect & {
	recipientName: string;
};

/** 收件人维度查询条件：接收者定位 + 排除软删除 */
function recipientConditions(recipient: MessageRecipient): SQL[] {
	return [
		eq(message.recipientType, recipient.type),
		eq(message.recipientId, recipient.id),
		notDeleted(message.deletedAt),
	];
}

/**
 * 创建一条消息
 * fire-and-forget：调用方无需等待写入完成
 */
export async function createMessage(
	params: CreateMessageParams,
): Promise<string> {
	const [record] = await db
		.insert(message)
		.values({
			recipientType: params.recipient.type,
			recipientId: params.recipient.id,
			title: params.title,
			content: params.content ?? null,
			type: params.type ?? "system",
			status: "unread",
			relatedLink: params.relatedLink ?? null,
		})
		.returning({ id: message.id });

	return record.id;
}

/**
 * 分页查询接收者消息列表
 */
export async function getMessages(
	params: GetMessagesParams,
): Promise<PaginatedResult<typeof message.$inferSelect>> {
	const page = params.page ?? DEFAULT_PAGE;
	const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
	const offset = paginationOffset(page, pageSize);

	const conditions = recipientConditions(params.recipient);

	if (params.status) {
		conditions.push(eq(message.status, params.status));
	}

	const whereCondition = and(...conditions);

	return executePaginatedQuery(
		db
			.select()
			.from(message)
			.where(whereCondition)
			.orderBy(desc(message.createdAt))
			.limit(pageSize)
			.offset(offset),
		db.$count(db.select().from(message).where(whereCondition)),
		page,
		pageSize,
	);
}

/**
 * 获取接收者未读消息数量
 */
export async function getUnreadCount(
	recipient: MessageRecipient,
): Promise<number> {
	const result = await db.$count(
		db
			.select()
			.from(message)
			.where(
				and(...recipientConditions(recipient), eq(message.status, "unread")),
			),
	);
	return result;
}

/**
 * 标记单条消息为已读
 */
export async function markAsRead(
	id: string,
	recipient: MessageRecipient,
): Promise<boolean> {
	const result = await db
		.update(message)
		.set({ status: "read" })
		.where(and(eq(message.id, id), ...recipientConditions(recipient)));

	return (result.rowCount ?? 0) > 0;
}

/**
 * 标记接收者所有未读消息为已读
 */
export async function markAllRead(
	recipient: MessageRecipient,
): Promise<number> {
	const result = await db
		.update(message)
		.set({ status: "read" })
		.where(
			and(...recipientConditions(recipient), eq(message.status, "unread")),
		);

	return result.rowCount ?? 0;
}

/**
 * 软删除单条消息（收件人维度校验）
 */
export async function deleteMessage(
	id: string,
	recipient: MessageRecipient,
): Promise<boolean> {
	const result = await db
		.update(message)
		.set({ deletedAt: new Date() })
		.where(and(eq(message.id, id), ...recipientConditions(recipient)));

	return (result.rowCount ?? 0) > 0;
}

/**
 * 批量解析消息接收者名称（按类型分查后合并，避免接收者名称快照过时）
 */
async function resolveRecipientNames(
	rows: (typeof message.$inferSelect)[],
): Promise<MessageWithRecipient[]> {
	const adminIds = rows
		.filter((r) => r.recipientType === "admin")
		.map((r) => r.recipientId);
	const clientIds = rows
		.filter((r) => r.recipientType === "client")
		.map((r) => r.recipientId);

	const [admins, clients] = await Promise.all([
		adminIds.length > 0
			? db
					.select({ id: adminUser.id, username: adminUser.username })
					.from(adminUser)
					.where(inArray(adminUser.id, adminIds))
			: Promise.resolve([]),
		clientIds.length > 0
			? db
					.select({ id: clientUser.id, username: clientUser.username })
					.from(clientUser)
					.where(inArray(clientUser.id, clientIds))
			: Promise.resolve([]),
	]);

	const nameMap = new Map<string, string>();
	for (const u of admins) nameMap.set(u.id, u.username);
	for (const u of clients) nameMap.set(u.id, u.username);

	return rows.map((row) => ({
		...row,
		recipientName: nameMap.get(row.recipientId) ?? "未知用户",
	}));
}

/**
 * 管理端全量分页查询消息（含接收者名称）
 */
export async function listMessages(
	params: ListMessagesParams,
): Promise<PaginatedResult<MessageWithRecipient>> {
	const page = params.page ?? DEFAULT_PAGE;
	const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
	const offset = paginationOffset(page, pageSize);

	const conditions: SQL[] = [notDeleted(message.deletedAt)];
	if (params.recipientType) {
		conditions.push(eq(message.recipientType, params.recipientType));
	}
	if (params.status) {
		conditions.push(eq(message.status, params.status));
	}
	if (params.type) {
		conditions.push(eq(message.type, params.type));
	}
	if (params.keyword) {
		conditions.push(ilike(message.title, `%${params.keyword}%`));
	}

	const whereCondition = and(...conditions);

	const [records, total] = await Promise.all([
		db
			.select()
			.from(message)
			.where(whereCondition)
			.orderBy(desc(message.createdAt))
			.limit(pageSize)
			.offset(offset),
		db.$count(db.select().from(message).where(whereCondition)),
	]);

	const rows = await resolveRecipientNames(records);
	return { records: rows, total, page, pageSize };
}

/**
 * 批量发送消息（单条 SQL 多行插入），返回发送条数
 */
export async function sendMessages(
	params: SendMessagesParams,
): Promise<number> {
	const rows: (typeof message.$inferInsert)[] = params.recipientIds.map(
		(id) => ({
			recipientType: params.recipientType,
			recipientId: id,
			title: params.title,
			content: params.content ?? null,
			type: params.type ?? "system",
			status: "unread",
			relatedLink: params.relatedLink ?? null,
		}),
	);

	const result = await db.insert(message).values(rows);
	return result.rowCount ?? rows.length;
}

/**
 * 管理端强制软删除任意消息（无收件人校验）
 */
export async function deleteMessageById(id: string): Promise<boolean> {
	const result = await db
		.update(message)
		.set({ deletedAt: new Date() })
		.where(and(eq(message.id, id), notDeleted(message.deletedAt)));

	return (result.rowCount ?? 0) > 0;
}

/**
 * 按类型 + 关键词搜索用户（发送消息表单的收件人选择器数据源）
 */
export async function searchRecipients(params: {
	recipientType: MessageRecipientType;
	keyword?: string;
}): Promise<RecipientOption[]> {
	const keyword = `%${params.keyword ?? ""}%`;
	const limit = 20;

	const keywordCondition = or(
		ilike(adminUser.username, keyword),
		ilike(adminUser.email, keyword),
	);

	if (params.recipientType === "admin") {
		const rows = await db
			.select({
				id: adminUser.id,
				username: adminUser.username,
				email: adminUser.email,
			})
			.from(adminUser)
			.where(and(notDeleted(adminUser.deletedAt), keywordCondition))
			.limit(limit);
		return rows.map((r) => ({
			id: r.id,
			label: `${r.username}（${r.email}）`,
		}));
	}

	const clientKeywordCondition = or(
		ilike(clientUser.username, keyword),
		ilike(clientUser.email, keyword),
	);

	const rows = await db
		.select({
			id: clientUser.id,
			username: clientUser.username,
			email: clientUser.email,
		})
		.from(clientUser)
		.where(and(notDeleted(clientUser.deletedAt), clientKeywordCondition))
		.limit(limit);
	return rows.map((r) => ({ id: r.id, label: `${r.username}（${r.email}）` }));
}
