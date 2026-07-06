/**
 * 客户端用户管理：CRUD 操作
 */
import bcrypt from "bcryptjs";
import { and, eq, ilike, or } from "drizzle-orm";
import { db } from "#/db/index";
import { clientUser } from "#/db/schema";
import type { PaginatedSortParams } from "#/lib/query/query-utils";
import { clearClientUserCache } from "#/server/client-auth/client-auth.server";
import {
	buildSortClause,
	executePaginatedQuery,
	notDeleted,
	paginationOffset,
} from "#/server/query/query-utils.server";

export type ClientUserRecord = typeof clientUser.$inferSelect;

export interface CreateClientUserInput {
	username: string;
	email: string;
	password: string;
}

export interface UpdateClientUserInput {
	username?: string;
	email?: string;
	status?: string;
	emailVerified?: boolean;
}

/** 客户端用户列表查询参数 */
export interface ClientUserListParams extends PaginatedSortParams {
	keyword?: string;
}

/** 获取客户端用户列表（支持关键词搜索和排序） */
export async function getClientUserList(params?: ClientUserListParams) {
	const {
		keyword,
		page = 1,
		pageSize = 20,
		sortField,
		sortOrder,
	} = params ?? {};
	const conditions = [notDeleted(clientUser.deletedAt)];
	if (keyword) {
		conditions.push(
			or(
				ilike(clientUser.username, `%${keyword}%`),
				ilike(clientUser.email, `%${keyword}%`),
			)!,
		);
	}

	const offset = paginationOffset(page, pageSize);

	const sortFieldMap = {
		createdAt: clientUser.createdAt,
		updatedAt: clientUser.updatedAt,
		username: clientUser.username,
		email: clientUser.email,
	};
	const direction = buildSortClause(
		sortFieldMap,
		sortField,
		sortOrder,
		"createdAt",
	);

	return executePaginatedQuery(
		db
			.select()
			.from(clientUser)
			.where(and(...conditions))
			.orderBy(direction)
			.limit(pageSize)
			.offset(offset),
		db.$count(
			db
				.select()
				.from(clientUser)
				.where(and(...conditions)),
		),
		page,
		pageSize,
	);
}

/** 获取单个客户端用户 */
export async function getClientUser(id: string) {
	return db.query.clientUser.findFirst({
		where: and(eq(clientUser.id, id), notDeleted(clientUser.deletedAt)),
	});
}

/** 创建客户端用户 */
export async function createClientUser(input: CreateClientUserInput) {
	const passwordHash = await bcrypt.hash(input.password, 12);
	const [record] = await db
		.insert(clientUser)
		.values({
			username: input.username,
			email: input.email,
			passwordHash,
			status: "active",
		})
		.returning();
	return record;
}

/** 更新客户端用户信息 */
export async function updateClientUser(
	id: string,
	input: UpdateClientUserInput,
) {
	const setData: Record<string, unknown> = { updatedAt: new Date() };
	if (input.username !== undefined) setData.username = input.username;
	if (input.email !== undefined) setData.email = input.email;
	if (input.status !== undefined) setData.status = input.status;
	if (input.emailVerified !== undefined)
		setData.emailVerified = input.emailVerified;

	const [record] = await db
		.update(clientUser)
		.set(setData)
		.where(and(eq(clientUser.id, id), notDeleted(clientUser.deletedAt)))
		.returning();
	if (record) {
		// 状态变更时清除缓存，避免返回已禁用的用户
		if (input.status !== undefined) {
			clearClientUserCache(id);
		}
	}
	return record;
}

/** 删除客户端用户（软删除） */
export async function deleteClientUser(id: string): Promise<boolean> {
	const existing = await getClientUser(id);
	if (!existing) return false;

	await db
		.update(clientUser)
		.set({ deletedAt: new Date() })
		.where(eq(clientUser.id, id));
	clearClientUserCache(id);
	return true;
}

/** 重置客户端用户密码 */
export async function resetClientPassword(
	id: string,
	newPassword: string,
): Promise<boolean> {
	const passwordHash = await bcrypt.hash(newPassword, 12);
	const [record] = await db
		.update(clientUser)
		.set({ passwordHash, updatedAt: new Date() })
		.where(and(eq(clientUser.id, id), notDeleted(clientUser.deletedAt)))
		.returning();
	if (record) {
	}
	return !!record;
}
