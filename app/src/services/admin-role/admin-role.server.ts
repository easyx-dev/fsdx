/**
 * 管理端角色管理：CRUD 操作
 */
import { and, eq, ilike, isNull, or } from "drizzle-orm";
import type { z } from "zod";
import { db } from "#/db/index";
import { adminRole } from "#/db/schema";
import type {
	adminRoleCreateSchema,
	adminRoleUpdateSchema,
} from "./admin-role.schemas";

export type AdminRoleRecord = typeof adminRole.$inferSelect;

/** 新建角色入参（schema 单一来源） */
export type CreateAdminRoleInput = z.infer<typeof adminRoleCreateSchema>;

/** 更新角色入参（不含 id，id 由服务层独立参数传递） */
export type UpdateAdminRoleInput = Omit<
	z.infer<typeof adminRoleUpdateSchema>,
	"id"
>;

/** 获取角色列表（支持关键词搜索） */
export async function getAdminRoleList(keyword?: string) {
	const conditions = [isNull(adminRole.deletedAt)];
	if (keyword) {
		conditions.push(
			or(
				ilike(adminRole.name, `%${keyword}%`),
				ilike(adminRole.slug, `%${keyword}%`),
			)!,
		);
	}
	return db
		.select()
		.from(adminRole)
		.where(and(...conditions))
		.orderBy(adminRole.createdAt);
}

/** 获取单个角色（仅内部使用） */
async function getAdminRole(id: string) {
	return db.query.adminRole.findFirst({
		where: and(eq(adminRole.id, id), isNull(adminRole.deletedAt)),
	});
}

/** 创建角色 */
export async function createAdminRole(input: CreateAdminRoleInput) {
	const [record] = await db
		.insert(adminRole)
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
export async function updateAdminRole(id: string, input: UpdateAdminRoleInput) {
	const [record] = await db
		.update(adminRole)
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
		.where(and(eq(adminRole.id, id), isNull(adminRole.deletedAt)))
		.returning();
	return record;
}

/** 删除角色（软删除） */
export async function deleteAdminRole(id: string): Promise<boolean> {
	const existing = await getAdminRole(id);
	if (!existing) return false;
	await db
		.update(adminRole)
		.set({ deletedAt: new Date() })
		.where(eq(adminRole.id, id));
	return true;
}
