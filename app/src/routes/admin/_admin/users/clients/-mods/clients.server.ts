/**
 * 客户端用户管理：CRUD 操作
 */
import bcrypt from "bcryptjs";
import { and, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import type { z } from "zod";
import { db } from "#/db/index";
import { clientRole, clientUser } from "#/db/schema";
import { clearClientUserCache } from "#/services/client-auth/client-auth.server";
import {
	buildSortClause,
	executePaginatedQuery,
	notDeleted,
	paginationOffset,
} from "#/services/query/query-utils.server";
import type { createSchema, listSchema, updateSchema } from "./clients.schemas";

export type ClientUserRecord = Omit<
	typeof clientUser.$inferSelect,
	"passwordHash" | "deletedAt"
>;

/** 客户端用户列表项（含角色名称数组） */
export interface ClientUserListItem extends ClientUserRecord {
	roleNames: string[];
}

/** 新建客户端用户入参（schema 单一来源） */
export type CreateClientUserInput = z.infer<typeof createSchema>;

/** 更新客户端用户入参（不含 id，id 由服务层独立参数传递） */
export type UpdateClientUserInput = Omit<z.infer<typeof updateSchema>, "id">;

/** 客户端用户列表查询参数 */
export type ClientUserListParams = z.infer<typeof listSchema>;

const clientUserSafeCols = {
	id: clientUser.id,
	username: clientUser.username,
	email: clientUser.email,
	avatar: clientUser.avatar,
	clientRoleIds: clientUser.clientRoleIds,
	status: clientUser.status,
	emailVerified: clientUser.emailVerified,
	lastLoginAt: clientUser.lastLoginAt,
	createdAt: clientUser.createdAt,
	updatedAt: clientUser.updatedAt,
};

/** 批量查询客户端角色 id 到名称的映射 */
async function getRoleNameMap(roleIds: string[]): Promise<Map<string, string>> {
	const roles = await db
		.select()
		.from(clientRole)
		.where(and(inArray(clientRole.id, roleIds), isNull(clientRole.deletedAt)));
	return new Map(roles.map((r) => [r.id, r.name]));
}

/** 校验客户端角色 id 均存在且未软删除，防止写入失效角色 */
async function assertClientRolesExist(roleIds: string[]): Promise<void> {
	if (roleIds.length === 0) return;
	const roles = await db
		.select()
		.from(clientRole)
		.where(and(inArray(clientRole.id, roleIds), isNull(clientRole.deletedAt)));
	const found = new Set(roles.map((r) => r.id));
	const invalid = roleIds.filter((id) => !found.has(id));
	if (invalid.length > 0) {
		throw new Error("存在无效或已删除的角色");
	}
}

/** 获取客户端用户列表（支持关键词搜索和排序，排除 password_hash 敏感字段） */
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

	const result = await executePaginatedQuery(
		db
			.select(clientUserSafeCols)
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

	const roleIds = [...new Set(result.records.flatMap((r) => r.clientRoleIds))];
	const roleNameMap = await getRoleNameMap(roleIds);

	return {
		...result,
		records: result.records.map((r) => ({
			...r,
			roleNames: r.clientRoleIds
				.map((id) => roleNameMap.get(id))
				.filter((name): name is string => !!name),
		})),
	};
}

/** 获取单个客户端用户 */
export async function getClientUser(id: string) {
	const [record] = await db
		.select()
		.from(clientUser)
		.where(and(eq(clientUser.id, id), notDeleted(clientUser.deletedAt)))
		.limit(1);
	return record;
}

/** 创建客户端用户 */
export async function createClientUser(input: CreateClientUserInput) {
	const roleIds = input.clientRoleIds ?? [];
	await assertClientRolesExist(roleIds);
	const passwordHash = await bcrypt.hash(input.password, 12);
	const [record] = await db
		.insert(clientUser)
		.values({
			username: input.username,
			email: input.email,
			passwordHash,
			status: "active",
			clientRoleIds: roleIds,
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
	if (input.clientRoleIds !== undefined) {
		await assertClientRolesExist(input.clientRoleIds);
		setData.clientRoleIds = input.clientRoleIds;
	}

	const [record] = await db
		.update(clientUser)
		.set(setData)
		.where(and(eq(clientUser.id, id), notDeleted(clientUser.deletedAt)))
		.returning();
	if (record) {
		// 状态或角色分配变更时清除缓存，避免返回已禁用用户或过期角色列表
		if (input.status !== undefined || input.clientRoleIds !== undefined) {
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
	return !!record;
}
