/**
 * 新闻前台 Server Functions
 */
import { createServerFn } from "@tanstack/react-start";
import DOMPurify from "isomorphic-dompurify";
import { z } from "zod";
import {
	getNewsBySlug,
	getNewsList,
	translateNewsRecord,
	translateNewsRecords,
} from "#/server/news/news.server";

/** 前台新闻列表分页 */
export const publishedNewsSchema = z.object({
	page: z.number().int().min(1).optional().default(1),
	pageSize: z.number().int().min(1).max(50).optional().default(12),
});

/** 前台新闻详情 slug */
export const newsSlugSchema = z.object({ slug: z.string().min(1) });

export const getPublishedNewsSFn = createServerFn({ method: "GET" })
	.inputValidator(publishedNewsSchema)
	.handler(async ({ data, context }) => {
		const { records, ...rest } = await getNewsList({
			status: "published",
			...data,
		});
		return {
			records: await translateNewsRecords(records, context.locale),
			...rest,
		};
	});

export const getNewsDetailSFn = createServerFn({ method: "GET" })
	.inputValidator(newsSlugSchema)
	.handler(async ({ data: { slug }, context }) => {
		const record = await getNewsBySlug(slug);
		if (!record) return null;
		const translated = await translateNewsRecord(record, context.locale);
		const safeHtml = DOMPurify.sanitize(translated.content ?? "");
		return { ...translated, html: safeHtml };
	});
