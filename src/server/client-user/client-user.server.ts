/**
 * 客户端用户管理：CRUD 操作
 */
import bcrypt from "bcryptjs";
import { and, eq, ilike, isNull, or } from "drizzle-orm";
import { db } from "#/db/index";
import { clientUser } from "#/db/schema";
import { clientUserCache } from "#/lib/cache/cache";

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

/** 获取客户端用户列表（支持关键词搜索） */
export async function getClientUserList(
	page = 1,
	pageSize = 20,
	keyword?: string,
) {
	const conditions = [isNull(clientUser.deletedAt)];
	if (keyword) {
		conditions.push(
			or(
				ilike(clientUser.username, `%${keyword}%`),
				ilike(clientUser.email, `%${keyword}%`),
			)!,
		);
	}

	const offset = (page - 1) * pageSize;
	const rows = await db
		.select()
		.from(clientUser)
		.where(and(...conditions))
		.orderBy(clientUser.createdAt)
		.limit(pageSize)
		.offset(offset);

	const [countResult] = await db
		.select({ count: db.$count(clientUser) })
		.from(clientUser)
		.where(and(...conditions));
	const total = Number(countResult?.count ?? 0);

	return { rows, total, page, pageSize };
}

/** 获取单个客户端用户 */
export async function getClientUser(id: string) {
	return db.query.clientUser.findFirst({
		where: and(eq(clientUser.id, id), isNull(clientUser.deletedAt)),
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
		.where(and(eq(clientUser.id, id), isNull(clientUser.deletedAt)))
		.returning();
	if (record) {
		// 状态变更时清除缓存，避免返回已禁用的用户
		if (input.status !== undefined) {
			clientUserCache.delete(id);
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
	clientUserCache.delete(id);
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
		.where(and(eq(clientUser.id, id), isNull(clientUser.deletedAt)))
		.returning();
	if (record) {
	}
	return !!record;
}
