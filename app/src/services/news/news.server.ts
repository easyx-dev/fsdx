/**
 * 新闻管理：CRUD + 导入导出 + slug 自动生成（领域实体唯一归属）
 * wangEditor 直接存储 HTML，无需服务端渲染转换
 * 国际化数据通过 translateNewsRecord / translateNewsRecords 按需组合获取
 */

import { toCsv, toJson } from "@fsdx/core/export";
import { DEFAULT_LOCALE, type Locale } from "@fsdx/core/i18n-types";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "#/db/index";
import { news } from "#/db/schema";
import {
	applyTranslations,
	getContentTranslations,
} from "#/services/i18n/i18n.server";
import {
	buildSortClause,
	executePaginatedQuery,
	notDeleted,
	paginationOffset,
} from "#/services/query/query-utils.server";
import type { PaginatedSortParams } from "#/types/query";

export type NewsRecord = typeof news.$inferSelect;

/** 新闻更新数据 */
export type NewsUpdateData = Partial<typeof news.$inferInsert>;

const MAX_RECOMMENDED = 5;

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

/** 新闻详情返回类型（扁平结构，避免 SF 序列化嵌套问题） */
export type NewsDetail = NewsRecord & { html: string };

/**
 * 根据标题生成 slug：中文字符用时间戳后缀，ASCII 直接 slugify
 */
export function generateSlug(title: string): string {
	const hasChinese = /[\u4e00-\u9fff]/.test(title);
	if (hasChinese) {
		return `news-${Date.now()}`;
	}
	return (
		title
			.toLowerCase()
			.replace(/[^\w\s-]/g, "")
			.replace(/\s+/g, "-")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 100) || `news-${Date.now()}`
	);
}

/** 确保 slug 唯一，重复时追加数字后缀 */
export async function ensureUniqueSlug(
	slug: string,
	excludeId?: string,
): Promise<string> {
	let uniqueSlug = slug;
	let counter = 1;
	const MAX_ATTEMPTS = 100;

	while (counter <= MAX_ATTEMPTS) {
		const conditions = [eq(news.slug, uniqueSlug), notDeleted(news.deletedAt)];
		if (excludeId) conditions.push(ne(news.id, excludeId));

		const [existing] = await db
			.select()
			.from(news)
			.where(and(...conditions))
			.limit(1);

		if (!existing) break;
		uniqueSlug = `${slug}-${counter}`;
		counter++;
	}

	// 超过最大尝试次数仍未找到唯一 slug
	if (counter > MAX_ATTEMPTS) {
		throw new Error(
			`无法为 slug "${slug}" 生成唯一标识（已尝试 ${MAX_ATTEMPTS} 次）`,
		);
	}

	return uniqueSlug;
}

/**
 * 校验推荐上限，additionalCount 用于导入场景计入待插入条目
 */
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

/**
 * 对单条新闻记录应用 content_translation 翻译
 * 仅非默认语言时调用，zh 直接从主表读取
 */
export async function translateNewsRecord(
	record: NewsRecord,
	locale: Locale,
): Promise<NewsRecord> {
	if (locale === DEFAULT_LOCALE) return record;

	const translations = await getContentTranslations("news", record.id, locale);

	return applyTranslations(record, translations);
}

/** 获取新闻列表（支持排序） */
export async function getNewsList(
	params?: PaginatedSortParams & {
		status?: string;
	},
) {
	const {
		status,
		page = 1,
		pageSize = 20,
		sortField,
		sortOrder,
	} = params ?? {};
	const offset = paginationOffset(page, pageSize);

	const conditions = [notDeleted(news.deletedAt)];
	if (status) conditions.push(eq(news.status, status));

	const whereCondition = and(...conditions);

	// 排序字段安全映射，仅允许已知列
	const sortFieldMap = {
		publishedAt: news.publishedAt,
		createdAt: news.createdAt,
		updatedAt: news.updatedAt,
		sortOrder: news.sortOrder,
	};
	const direction = buildSortClause(
		sortFieldMap,
		sortField,
		sortOrder,
		"sortOrder",
	);

	// 默认：置顶优先 → sort DESC → 创建时间 DESC；用户排序时：置顶优先 → 用户选择
	const orderBy = sortField
		? [desc(news.isPinned), direction]
		: [desc(news.isPinned), desc(news.sortOrder), desc(news.createdAt)];

	return executePaginatedQuery(
		db
			.select()
			.from(news)
			.where(whereCondition)
			.orderBy(...orderBy)
			.limit(pageSize)
			.offset(offset),
		db.$count(db.select().from(news).where(whereCondition)),
		page,
		pageSize,
	);
}

/**
 * 根据 slug 获取单条新闻（前台用）
 * 返回扁平结构：NewsRecord 字段 + html，不包含国际化翻译
 */
export async function getNewsBySlug(slug: string): Promise<NewsDetail | null> {
	const [record] = await db
		.select()
		.from(news)
		.where(
			and(
				eq(news.slug, slug),
				eq(news.status, "published"),
				notDeleted(news.deletedAt),
			),
		)
		.limit(1);
	if (!record) return null;

	return { ...record, html: record.content ?? "" };
}

/** 根据 id 获取单条新闻（管理端用） */
export async function getNewsById(id: string): Promise<NewsRecord | null> {
	const [record] = await db
		.select()
		.from(news)
		.where(and(eq(news.id, id), notDeleted(news.deletedAt)))
		.limit(1);
	return record ?? null;
}

/** 创建新闻 */
export async function createNews(params: {
	title: string;
	slug?: string;
	description?: string;
	content?: string;
	coverImageId?: string;
	externalUrl?: string;
	status?: string;
	isPinned?: boolean;
	isRecommended?: boolean;
	sortOrder?: number;
	publishedAt?: Date | string;
	createdById?: string;
}): Promise<NewsRecord> {
	// 推荐上限校验（本次将新增 1 条推荐）
	if (params.isRecommended) {
		await checkRecommendedLimit(undefined, 1);
	}

	let slug = params.slug?.trim() || generateSlug(params.title);
	slug = await ensureUniqueSlug(slug);

	// 将 publishedAt 字符串转为 Date（前端 DatePicker 传出 ISO 字符串）
	const publishedAtValue = params.publishedAt
		? new Date(params.publishedAt)
		: null;

	const [record] = await db
		.insert(news)
		.values({
			title: params.title,
			slug,
			description: params.description,
			content: params.content,
			coverImageId: params.coverImageId,
			externalUrl: params.externalUrl,
			status: params.status || "draft",
			isPinned: params.isPinned ?? false,
			isRecommended: params.isRecommended ?? false,
			sortOrder: params.sortOrder ?? 0,
			publishedAt:
				params.status === "published" ? publishedAtValue || new Date() : null,
			createdById: params.createdById,
		})
		.returning();

	return record;
}

/** 变更新闻状态（发布/归档） */
export async function changeNewsStatus(
	id: string,
	status: string,
): Promise<{ success: boolean }> {
	const updateData: Record<string, unknown> = {
		status,
		updatedAt: new Date(),
	};
	if (status === "published") {
		const [existing] = await db
			.select()
			.from(news)
			.where(eq(news.id, id))
			.limit(1);
		if (existing && !existing.publishedAt) updateData.publishedAt = new Date();
	}
	await db.update(news).set(updateData).where(eq(news.id, id));

	return { success: true };
}

/** 删除新闻（软删除） */
export async function deleteNews(id: string): Promise<boolean> {
	const existing = await getNewsById(id);
	if (!existing) return false;

	await db.update(news).set({ deletedAt: new Date() }).where(eq(news.id, id));

	return true;
}

/** 批量翻译新闻记录（一次查询获取所有翻译，避免 N+1） */
export async function translateNewsRecords(
	records: NewsRecord[],
	locale: Locale,
): Promise<NewsRecord[]> {
	if (locale === DEFAULT_LOCALE) return records;
	if (records.length === 0) return records;

	const ids = records.map((r) => r.id);
	const translationsMap = await getContentTranslations("news", ids, locale);

	return applyTranslations(records, translationsMap);
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
