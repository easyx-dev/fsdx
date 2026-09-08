/**
 * 新闻前台 Server Functions
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getNewsBySlug, getNewsList } from "#/services/news/news.server";
import {
	translateRecord,
	translateRecords,
} from "#/shared-services/i18n/i18n.server";

/** 前台新闻列表分页 */
export const publishedNewsSchema = z.object({
	page: z.number().int().min(1).optional().default(1),
	pageSize: z.number().int().min(1).max(50).optional().default(12),
});

/** 前台新闻详情 slug */
export const newsSlugSchema = z.object({ slug: z.string().min(1) });

export const getPublishedNewsSFn = createServerFn({ method: "GET" })
	.validator(publishedNewsSchema)
	.handler(async ({ data, context }) => {
		const { records, ...rest } = await getNewsList({
			status: "published",
			...data,
		});
		return {
			records: await translateRecords(records, "news", context.locale),
			...rest,
		};
	});

export const getNewsDetailSFn = createServerFn({ method: "GET" })
	.validator(newsSlugSchema)
	.handler(async ({ data: { slug }, context }) => {
		const record = await getNewsBySlug(slug);
		if (!record) return null;
		const translated = await translateRecord(record, "news", context.locale);
		// admin 富文本视为受信任内容，正文直接透传
		return { ...translated, html: translated.content ?? "" };
	});
