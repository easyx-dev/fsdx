/**
 * 公共 Zod Schema 定义
 * 所有管理端 CRUD 页面共用的校验 schema，避免重复定义
 */
import { z } from "zod";

/** ID 校验（删除/单项操作复用） */
export const idSchema = z.object({ id: z.string().min(1) });

/** 排序方向 */
export const sortOrderField = z.enum(["ascend", "descend"]).optional();

/** 重置密码校验 */
export const resetPwdSchema = z.object({
	id: z.string().min(1),
	password: z.string().min(6).max(100),
});

/** 通用列表查询参数 */
export const listSchema = z.object({
	page: z.number().optional(),
	pageSize: z.number().optional(),
	keyword: z.string().optional(),
	sortField: z.string().optional(),
	sortOrder: sortOrderField,
});
