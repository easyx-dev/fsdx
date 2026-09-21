/**
 * 客户端用户（client_user）zod schema：单一来源
 */
import { z } from "zod";
import { listSchema } from "#/validators/common.schemas";

/** 客户端用户列表查询：通用分页 / 排序参数 + 关键词（关键词已含于基座，无额外业务筛选） */
export const clientUserListSchema = listSchema;

/** 新建客户端用户 */
export const createSchema = z.object({
	username: z.string().min(1).max(50),
	email: z.string().email().max(255),
	password: z.string().min(6).max(100),
	clientRoleIds: z.array(z.string().min(1)).optional(),
});

/** 更新客户端用户 */
export const updateSchema = z.object({
	id: z.string().min(1),
	username: z.string().min(1).max(50).optional(),
	email: z.string().email().max(255).optional(),
	status: z.string().optional(),
	emailVerified: z.boolean().optional(),
	clientRoleIds: z.array(z.string().min(1)).optional(),
});

/** 通过 id 获取/删除单条客户端用户 */
export const idSchema = z.object({ id: z.string().min(1) });

/** 重置客户端用户密码 */
export const resetPwdSchema = z.object({
	id: z.string().min(1),
	password: z.string().min(6).max(100),
});
