/**
 * 管理端用户（admin_user）zod schema：单一来源
 */
import { z } from "zod";

/** 管理员列表查询 */
export const listSchema = z.object({
	page: z.number().optional(),
	pageSize: z.number().optional(),
	keyword: z.string().optional(),
	sortField: z.string().optional(),
	sortOrder: z.enum(["ascend", "descend"]).optional(),
});

/** 新建管理员 */
export const createSchema = z.object({
	username: z.string().min(1).max(50),
	email: z.string().email().max(255),
	password: z.string().min(6).max(100),
	adminRoleIds: z.array(z.string().min(1)).min(1, "至少分配一个角色"),
});

/** 更新管理员 */
export const updateSchema = z.object({
	id: z.string().min(1),
	username: z.string().min(1).max(50).optional(),
	email: z.string().email().max(255).optional(),
	adminRoleIds: z
		.array(z.string().min(1))
		.min(1, "至少分配一个角色")
		.optional(),
	status: z.string().optional(),
});

/** 通过 id 删除/查询管理员 */
export const idSchema = z.object({ id: z.string().min(1) });

/** 重置管理员密码 */
export const resetPwdSchema = z.object({
	id: z.string().min(1),
	password: z.string().min(6).max(100),
});
