/**
 * 新闻管理：CRUD 操作 + slug 自动生成
 * wangEditor 直接存储 HTML，无需服务端渲染转换
 * 国际化数据通过 translateNewsRecord / translateNewsRecords 按需组合获取
 */
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "#/db/index";
import { news } from "#/db/schema";
import { DEFAULT_LOCALE, type Locale } from "#/lib/i18n/i18n.types";
import type { PaginatedSortParams } from "#/lib/query/query-utils";
import { getContentTranslations } from "#/server/i18n/i18n.server";
import {
	buildSortClause,
	executePaginatedQuery,
	notDeleted,
	paginationOffset,
} from "#/server/query/query-utils.server";

export type NewsRecord = typeof news.$inferSelect;

/** 新闻详情返回类型（扁平结构，避免 SF 序列化嵌套问题） */
export type NewsDetail = NewsRecord & { html: string };

/**
 * 根据标题生成 slug：中文字符用时间戳后缀，ASCII 直接 slugify
 */
function generateSlug(title: string): string {
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
async function ensureUniqueSlug(
	slug: string,
	excludeId?: string,
): Promise<string> {
	let uniqueSlug = slug;
	let counter = 1;
	const MAX_ATTEMPTS = 100;

	while (counter <= MAX_ATTEMPTS) {
		const conditions = [eq(news.slug, uniqueSlug), notDeleted(news.deletedAt)];
		if (excludeId) conditions.push(ne(news.id, excludeId));

		const existing = await db.query.news.findFirst({
			where: and(...conditions),
		});

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
 * 对单条新闻记录应用 content_translation 翻译
 * 仅非默认语言时调用，zh 直接从主表读取
 */
export async function translateNewsRecord(
	record: NewsRecord,
	locale: Locale,
): Promise<NewsRecord> {
	if (locale === DEFAULT_LOCALE) return record;

	const translations = await getContentTranslations("news", record.id, locale);

	const result = { ...record };
	for (const [fieldName, ct] of Object.entries(translations)) {
		(result as Record<string, unknown>)[fieldName] = ct.value;
	}

	return result;
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
	const record = await db.query.news.findFirst({
		where: and(
			eq(news.slug, slug),
			eq(news.status, "published"),
			notDeleted(news.deletedAt),
		),
	});
	if (!record) return null;

	return { ...record, html: record.content ?? "" };
}

/** 根据 id 获取单条新闻（管理端用） */
export async function getNewsById(id: string): Promise<NewsRecord | null> {
	const record = await db.query.news.findFirst({
		where: and(eq(news.id, id), notDeleted(news.deletedAt)),
	});
	return record ?? null;
}

/** 创建新闻 */
export async function createNews(params: {
	title: string;
	slug?: string;
	description?: string;
	content?: string;
	coverImageId?: string;
	status?: string;
	isPinned?: boolean;
	sortOrder?: number;
	publishedAt?: Date | string;
	createdById?: string;
}): Promise<NewsRecord> {
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
			status: params.status || "draft",
			isPinned: params.isPinned ?? false,
			sortOrder: params.sortOrder ?? 0,
			publishedAt:
				params.status === "published" ? publishedAtValue || new Date() : null,
			createdById: params.createdById,
		})
		.returning();

	return record;
}

/** 更新新闻 */
export async function updateNews(
	id: string,
	params: {
		title?: string;
		slug?: string;
		description?: string;
		content?: string;
		coverImageId?: string | null;
		status?: string;
		isPinned?: boolean;
		sortOrder?: number;
		publishedAt?: Date | string | null;
		updatedById?: string;
	},
): Promise<NewsRecord | null> {
	const existing = await getNewsById(id);
	if (!existing) return null;

	let slug = existing.slug;
	if (params.slug && params.slug !== existing.slug) {
		slug = await ensureUniqueSlug(params.slug, id);
	}

	// 将 publishedAt 字符串转为 Date（前端 DatePicker 传出 ISO 字符串）
	const publishedAtValue =
		params.publishedAt !== undefined
			? params.publishedAt
				? new Date(params.publishedAt)
				: null
			: undefined;

	const updateData: Record<string, unknown> = {
		title: params.title,
		description: params.description,
		content: params.content,
		coverImageId: params.coverImageId,
		status: params.status,
		isPinned: params.isPinned,
		sortOrder: params.sortOrder,
		slug,
		updatedAt: new Date(),
	};

	// 清除 undefined 字段避免覆盖数据库值
	for (const key of Object.keys(updateData)) {
		if (updateData[key] === undefined) delete updateData[key];
	}

	// 发布时设置发布时间
	if (publishedAtValue !== undefined) {
		updateData.publishedAt = publishedAtValue;
	} else if (params.status === "published" && !existing.publishedAt) {
		updateData.publishedAt = new Date();
	}

	const [updated] = await db
		.update(news)
		.set(updateData)
		.where(eq(news.id, id))
		.returning();

	return updated ?? null;
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
		const existing = await db.query.news.findFirst({
			where: eq(news.id, id),
		});
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

/** 批量翻译新闻记录（函数式组合，调用方在获取列表后按需调用） */
export async function translateNewsRecords(
	records: NewsRecord[],
	locale: Locale,
): Promise<NewsRecord[]> {
	if (locale === DEFAULT_LOCALE) return records;
	return Promise.all(records.map((r) => translateNewsRecord(r, locale)));
}

/** 获取所有未删除新闻（用于导出） */
export async function getAllNewsForExport(): Promise<NewsRecord[]> {
	return db
		.select()
		.from(news)
		.where(notDeleted(news.deletedAt))
		.orderBy(desc(news.sortOrder), desc(news.createdAt));
}

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
