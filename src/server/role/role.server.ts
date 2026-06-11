/**
 * 角色管理：CRUD 操作
 */
import { and, eq, ilike, isNull, or } from "drizzle-orm";
import { db } from "#/db/index";
import { role } from "#/db/schema";

export type RoleRecord = typeof role.$inferSelect;

export interface CreateRoleInput {
	name: string;
	slug: string;
	permissions: string[];
	description?: string;
}

export interface UpdateRoleInput {
	name?: string;
	slug?: string;
	permissions?: string[];
	description?: string;
}

/** 获取角色列表（支持关键词搜索） */
export async function getRoleList(keyword?: string) {
	const conditions = [isNull(role.deletedAt)];
	if (keyword) {
		conditions.push(
			or(ilike(role.name, `%${keyword}%`), ilike(role.slug, `%${keyword}%`))!,
		);
	}
	return db
		.select()
		.from(role)
		.where(and(...conditions))
		.orderBy(role.createdAt);
}

/** 获取单个角色 */
export async function getRole(id: string) {
	return db.query.role.findFirst({
		where: and(eq(role.id, id), isNull(role.deletedAt)),
	});
}

/** 创建角色 */
export async function createRole(input: CreateRoleInput) {
	const [record] = await db
		.insert(role)
		.values({
			name: input.name,
			slug: input.slug,
			permissions: input.permissions,
			description: input.description ?? null,
		})
		.returning();
	return record;
}

/** 更新角色 */
export async function updateRole(id: string, input: UpdateRoleInput) {
	const [record] = await db
		.update(role)
		.set({
			...(input.name !== undefined && { name: input.name }),
			...(input.slug !== undefined && { slug: input.slug }),
			...(input.permissions !== undefined && {
				permissions: input.permissions,
			}),
			...(input.description !== undefined && {
				description: input.description,
			}),
			updatedAt: new Date(),
		})
		.where(and(eq(role.id, id), isNull(role.deletedAt)))
		.returning();
	if (record) {
	}
	return record;
}

/** 删除角色（软删除） */
export async function deleteRole(id: string): Promise<boolean> {
	const existing = await getRole(id);
	if (!existing) return false;
	await db.update(role).set({ deletedAt: new Date() }).where(eq(role.id, id));
	return true;
}
