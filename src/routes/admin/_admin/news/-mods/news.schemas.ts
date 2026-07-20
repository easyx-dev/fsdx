/**
 * 新闻路由共享 Zod Schema
 */
import { z } from "zod";

/** 通过 id 获取/删除单条新闻 */
export const getNewsSchema = z.object({ id: z.string().min(1) });

/** 新闻列表查询 */
export const listSchema = z.object({
	status: z.string().optional(),
	page: z.number().optional(),
	sortField: z.string().optional(),
	sortOrder: z.enum(["ascend", "descend"]).optional(),
});

/** 变更新闻状态 */
export const statusSchema = z.object({
	id: z.string().min(1),
	status: z.enum(["draft", "published", "archived"]),
});

/** 新闻导入 */
export const newsImportSchema = z.object({
	news: z.array(
		z.object({
			title: z.string().min(1),
			description: z.string().optional(),
			content: z.string().optional(),
			externalUrl: z.string().optional(),
			coverImageId: z.string().optional(),
			status: z.enum(["draft", "published"]).default("draft"),
			isPinned: z.boolean().default(false),
			isRecommended: z.boolean().default(false),
			sortOrder: z.number().int().default(0),
		}),
	),
});

/** 新闻导出 */
export const exportSchema = z.object({
	format: z.enum(["csv", "json"]),
});

/** 新建新闻 */
export const createNewsSchema = z.object({
	title: z.string().min(1).max(500),
	slug: z.string().max(500).optional(),
	description: z.string().optional(),
	content: z.string().optional(),
	externalUrl: z.string().url("请输入合法的 URL").optional().or(z.literal("")),
	coverImageId: z.string().optional(),
	status: z.enum(["draft", "published"]).default("draft"),
	isPinned: z.boolean().default(false),
	isRecommended: z.boolean().default(false),
	publishedAt: z.string().optional(),
	sortOrder: z.number().int().optional(),
});

/** 更新新闻 */
export const updateNewsSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1).max(500),
	slug: z.string().max(500).optional(),
	description: z.string().optional(),
	content: z.string().optional(),
	externalUrl: z.string().url("请输入合法的 URL").optional().or(z.literal("")),
	coverImageId: z.string().optional().nullable(),
	status: z.enum(["draft", "published", "archived"]),
	isPinned: z.boolean(),
	isRecommended: z.boolean(),
	publishedAt: z.string().optional().nullable(),
	sortOrder: z.number().int().optional(),
});
