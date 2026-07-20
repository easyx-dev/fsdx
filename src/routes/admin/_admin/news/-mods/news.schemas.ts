/**
 * 新闻路由共享 Zod Schema
 * create / edit / 抽屉编辑复用，避免各路由文件重复定义
 */

import { z } from "zod";

/** 通过 id 获取单条新闻 */
export const getNewsSchema = z.object({ id: z.string().min(1) });

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
