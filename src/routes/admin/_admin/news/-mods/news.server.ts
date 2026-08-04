/**
 * 新闻管理路由服务层：路由级数据库操作
 */
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "#/db/index";
import { news } from "#/db/schema";
import { toCsv, toJson } from "#/lib/export/export.utils";
import type { NewsRecord } from "#/services/news/news.server";
import { notDeleted } from "#/services/query/query-utils.server";
import { generateSlug } from "./news.functions";

const MAX_RECOMMENDED = 5;

/** 新闻更新数据 */
export type NewsUpdateData = Partial<typeof news.$inferInsert>;

/** 新闻导出 CSV 列定义 */
export const NEWS_EXPORT_COLUMNS: { key: string; title: string }[] = [
	{ key: "id", title: "ID" },
	{ key: "title", title: "标题" },
	{ key: "slug", title: "Slug" },
	{ key: "description", title: "摘要" },
	{ key: "content", title: "正文" },
	{ key: "status", title: "状态" },
	{ key: "isPinned", title: "是否置顶" },
	{ key: "publishedAt", title: "发布时间" },
	{ key: "createdAt", title: "创建时间" },
	{ key: "updatedAt", title: "更新时间" },
];

/** 确保 slug 唯一 */
export async function ensureUniqueSlug(
	slug: string,
	excludeId?: string,
): Promise<string> {
	let uniqueSlug = slug;
	let counter = 1;
	while (counter <= 100) {
		const conditions = [eq(news.slug, uniqueSlug), notDeleted(news.deletedAt)];
		if (excludeId) conditions.push(ne(news.id, excludeId));
		const existing = await db.query.news.findFirst({
			where: and(...conditions),
		});
		if (!existing) break;
		uniqueSlug = `${slug}-${counter}`;
		counter++;
	}
	if (counter > 100) {
		throw new Error(`无法为 slug "${slug}" 生成唯一标识`);
	}
	return uniqueSlug;
}

/** 校验推荐上限，additionalCount 用于导入场景计入待插入条目 */
export async function checkRecommendedLimit(
	excludeId?: string,
	additionalCount = 0,
): Promise<void> {
	const conditions = [eq(news.isRecommended, true), notDeleted(news.deletedAt)];
	if (excludeId) conditions.push(ne(news.id, excludeId));
	const recommendedCount = await db.$count(
		db
			.select()
			.from(news)
			.where(and(...conditions)),
	);
	if (recommendedCount + additionalCount > MAX_RECOMMENDED) {
		throw new Error(`最多推荐 ${MAX_RECOMMENDED} 条新闻`);
	}
}

/** 更新新闻记录并返回更新后的记录 */
export async function updateNewsRecord(
	id: string,
	data: NewsUpdateData,
): Promise<NewsRecord | null> {
	const [record] = await db
		.update(news)
		.set({ ...data, updatedAt: new Date() })
		.where(eq(news.id, id))
		.returning();
	return record ?? null;
}

/** 批量导入新闻（先批量查询已有标题去重，避免 N+1） */
export async function importNewsItems(
	items: {
		title: string;
		slug?: string;
		description?: string | null;
		content?: string | null;
		externalUrl?: string | null;
		coverImageId?: string | null;
		status?: string;
		isPinned?: boolean;
		isRecommended?: boolean;
		sortOrder?: number;
	}[],
	userId: string,
): Promise<{ created: number; skipped: number }> {
	// 一次性查询所有标题对应的已有新闻，构建去重集合
	const existingNews = await db
		.select({ title: news.title })
		.from(news)
		.where(
			and(
				inArray(
					news.title,
					items.map((r) => r.title),
				),
				notDeleted(news.deletedAt),
			),
		);
	const existingTitles = new Set(existingNews.map((n) => n.title));

	let created = 0;
	let skipped = 0;
	for (const row of items) {
		if (existingTitles.has(row.title)) {
			skipped++;
			continue;
		}
		const slug = await ensureUniqueSlug(row.slug || generateSlug(row.title));
		await db.insert(news).values({
			title: row.title,
			slug,
			description: row.description ?? null,
			content: row.content ?? null,
			externalUrl: row.externalUrl ?? null,
			coverImageId: row.coverImageId ?? null,
			status: row.status ?? "draft",
			isPinned: row.isPinned ?? false,
			isRecommended: row.isRecommended ?? false,
			sortOrder: row.sortOrder ?? 0,
			publishedAt: row.status === "published" ? new Date() : null,
			createdById: userId,
		});
		created++;
	}
	return { created, skipped };
}

/** 导出全部新闻记录 */
export async function exportAllNews(): Promise<NewsRecord[]> {
	return db
		.select()
		.from(news)
		.where(notDeleted(news.deletedAt))
		.orderBy(desc(news.sortOrder), desc(news.createdAt));
}

/** 按格式导出新闻 */
export function formatNewsExport(
	records: NewsRecord[],
	format: "csv" | "json",
): { format: "csv" | "json"; content: string } {
	if (format === "csv") {
		return {
			format: "csv" as const,
			content: toCsv(records, NEWS_EXPORT_COLUMNS),
		};
	}
	return { format: "json" as const, content: toJson(records) };
}
