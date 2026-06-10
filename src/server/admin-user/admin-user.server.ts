/**
 * 管理员用户管理：CRUD 操作
 */
import bcrypt from "bcryptjs";
import { and, eq, ilike, isNull, or } from "drizzle-orm";
import { db } from "#/db/index";
import { adminUser, role } from "#/db/schema";
import { logger } from "#/lib/logger/logger";

export type AdminUserRecord = typeof adminUser.$inferSelect;

/** 管理员列表项（含角色名称） */
export interface AdminUserListItem extends AdminUserRecord {
	roleName?: string | null;
}

export interface CreateAdminUserInput {
	username: string;
	email: string;
	password: string;
	roleId: string;
}

export interface UpdateAdminUserInput {
	username?: string;
	email?: string;
	roleId?: string;
	status?: string;
}

/** 获取管理员列表（含角色名称，支持关键词搜索） */
export async function getAdminUserList(
	page = 1,
	pageSize = 20,
	keyword?: string,
) {
	const conditions = [isNull(adminUser.deletedAt)];
	if (keyword) {
		conditions.push(
			or(
				ilike(adminUser.username, `%${keyword}%`),
				ilike(adminUser.email, `%${keyword}%`),
			)!,
		);
	}

	const offset = (page - 1) * pageSize;
	const rows = await db
		.select({
			id: adminUser.id,
			username: adminUser.username,
			email: adminUser.email,
			avatar: adminUser.avatar,
			roleId: adminUser.roleId,
			isRoot: adminUser.isRoot,
			status: adminUser.status,
			lastLoginAt: adminUser.lastLoginAt,
			createdAt: adminUser.createdAt,
			updatedAt: adminUser.updatedAt,
			deletedAt: adminUser.deletedAt,
			passwordHash: adminUser.passwordHash,
			roleName: role.name,
		})
		.from(adminUser)
		.leftJoin(role, eq(adminUser.roleId, role.id))
		.where(and(...conditions))
		.orderBy(adminUser.createdAt)
		.limit(pageSize)
		.offset(offset);

	const [countResult] = await db
		.select({ count: db.$count(adminUser) })
		.from(adminUser)
		.where(and(...conditions));
	const total = Number(countResult?.count ?? 0);

	return { rows, total, page, pageSize };
}

/** 获取单个管理员 */
export async function getAdminUser(id: string) {
	return db.query.adminUser.findFirst({
		where: and(eq(adminUser.id, id), isNull(adminUser.deletedAt)),
	});
}

/** 创建管理员 */
export async function createAdminUser(input: CreateAdminUserInput) {
	const passwordHash = await bcrypt.hash(input.password, 12);
	const [record] = await db
		.insert(adminUser)
		.values({
			username: input.username,
			email: input.email,
			passwordHash,
			roleId: input.roleId,
			status: "active",
		})
		.returning();
	logger.info({ id: record.id, username: record.username }, "管理员已创建");
	return record;
}

/** 更新管理员信息 */
export async function updateAdminUser(id: string, input: UpdateAdminUserInput) {
	const setData: Record<string, unknown> = { updatedAt: new Date() };
	if (input.username !== undefined) setData.username = input.username;

	// 禁止将 root 管理员设为禁用状态
	if (input.status === "disabled") {
		const existing = await getAdminUser(id);
		if (existing?.isRoot) throw new Error("不允许禁用 root 管理员");
	}

	if (input.email !== undefined) setData.email = input.email;
	if (input.roleId !== undefined) setData.roleId = input.roleId;
	if (input.status !== undefined) setData.status = input.status;

	const [record] = await db
		.update(adminUser)
		.set(setData)
		.where(and(eq(adminUser.id, id), isNull(adminUser.deletedAt)))
		.returning();
	if (record) {
		logger.info({ id, username: record.username }, "管理员信息已更新");
	}
	return record;
}

/** 删除管理员（软删除，不允许删除 root 和自己） */
export async function deleteAdminUser(
	id: string,
	currentUserId: string,
): Promise<boolean> {
	const existing = await getAdminUser(id);
	if (!existing) return false;
	if (existing.isRoot) throw new Error("不允许删除 root 管理员");
	if (existing.id === currentUserId) throw new Error("不允许删除自己的账号");

	await db
		.update(adminUser)
		.set({ deletedAt: new Date() })
		.where(eq(adminUser.id, id));
	logger.info({ id, username: existing.username }, "管理员已删除");
	return true;
}

/** 重置管理员密码 */
export async function resetAdminPassword(
	id: string,
	newPassword: string,
): Promise<boolean> {
	const passwordHash = await bcrypt.hash(newPassword, 12);
	const [record] = await db
		.update(adminUser)
		.set({ passwordHash, updatedAt: new Date() })
		.where(and(eq(adminUser.id, id), isNull(adminUser.deletedAt)))
		.returning();
	if (record) {
		logger.info({ id, username: record.username }, "管理员密码已重置");
	}
	return !!record;
}
