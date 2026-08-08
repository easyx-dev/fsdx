/**
 * 客户端角色管理：CRUD 操作
 */
import { and, eq, ilike, isNull, or } from "drizzle-orm";
import type { z } from "zod";
import { db } from "#/db/index";
import { clientRole } from "#/db/schema";
import type {
	clientRoleCreateSchema,
	clientRoleUpdateSchema,
} from "./client-role.schemas";

export type ClientRoleRecord = typeof clientRole.$inferSelect;

/** 新建角色入参（schema 单一来源） */
export type CreateClientRoleInput = z.infer<typeof clientRoleCreateSchema>;

/** 更新角色入参（不含 id，id 由服务层独立参数传递） */
export type UpdateClientRoleInput = Omit<
	z.infer<typeof clientRoleUpdateSchema>,
	"id"
>;

/** 获取角色列表（支持关键词搜索） */
export async function getClientRoleList(keyword?: string) {
	const conditions = [isNull(clientRole.deletedAt)];
	if (keyword) {
		conditions.push(
			or(
				ilike(clientRole.name, `%${keyword}%`),
				ilike(clientRole.slug, `%${keyword}%`),
			)!,
		);
	}
	return db
		.select()
		.from(clientRole)
		.where(and(...conditions))
		.orderBy(clientRole.createdAt);
}

/** 获取单个角色（仅内部使用） */
async function getClientRole(id: string) {
	const [record] = await db
		.select()
		.from(clientRole)
		.where(and(eq(clientRole.id, id), isNull(clientRole.deletedAt)))
		.limit(1);
	return record;
}

/** 创建角色 */
export async function createClientRole(input: CreateClientRoleInput) {
	const [record] = await db
		.insert(clientRole)
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
export async function updateClientRole(
	id: string,
	input: UpdateClientRoleInput,
) {
	const [record] = await db
		.update(clientRole)
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
		.where(and(eq(clientRole.id, id), isNull(clientRole.deletedAt)))
		.returning();
	return record;
}

/** 删除角色（软删除） */
export async function deleteClientRole(id: string): Promise<boolean> {
	const existing = await getClientRole(id);
	if (!existing) return false;
	await db
		.update(clientRole)
		.set({ deletedAt: new Date() })
		.where(eq(clientRole.id, id));
	return true;
}
