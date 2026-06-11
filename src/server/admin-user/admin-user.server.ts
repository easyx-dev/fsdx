/**
 * 管理员用户管理：CRUD 操作
 */
import bcrypt from "bcryptjs";
import { and, eq, ilike, or } from "drizzle-orm";
import { db } from "#/db/index";
import { adminUser, role } from "#/db/schema";
import type { PaginatedSortParams } from "#/lib/query/query-utils";
import {
	buildSortClause,
	executePaginatedQuery,
	notDeleted,
	paginationOffset,
} from "#/server/query/query-utils.server";

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

/** 管理员列表查询参数 */
export interface AdminUserListParams extends PaginatedSortParams {
	keyword?: string;
}

/** 获取管理员列表（含角色名称，支持关键词搜索和排序） */
export async function getAdminUserList(params?: AdminUserListParams) {
	const {
		keyword,
		page = 1,
		pageSize = 20,
		sortField,
		sortOrder,
	} = params ?? {};
	const conditions = [notDeleted(adminUser.deletedAt)];
	if (keyword) {
		conditions.push(
			or(
				ilike(adminUser.username, `%${keyword}%`),
				ilike(adminUser.email, `%${keyword}%`),
			)!,
		);
	}

	const offset = paginationOffset(page, pageSize);

	const sortFieldMap = {
		createdAt: adminUser.createdAt,
		updatedAt: adminUser.updatedAt,
		username: adminUser.username,
		email: adminUser.email,
		lastLoginAt: adminUser.lastLoginAt,
	};
	const direction = buildSortClause(
		sortFieldMap,
		sortField,
		sortOrder,
		"createdAt",
	);

	return executePaginatedQuery(
		db
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
			.orderBy(direction)
			.limit(pageSize)
			.offset(offset),
		db.$count(
			db
				.select()
				.from(adminUser)
				.where(and(...conditions)),
		),
		page,
		pageSize,
	);
}

/** 获取单个管理员 */
export async function getAdminUser(id: string) {
	return db.query.adminUser.findFirst({
		where: and(eq(adminUser.id, id), notDeleted(adminUser.deletedAt)),
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
		.where(and(eq(adminUser.id, id), notDeleted(adminUser.deletedAt)))
		.returning();
	if (record) {
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
		.where(and(eq(adminUser.id, id), notDeleted(adminUser.deletedAt)))
		.returning();
	if (record) {
	}
	return !!record;
}
