/**
 * 新闻管理：CRUD 操作 + slug 自动生成
 * wangEditor 直接存储 HTML，无需服务端渲染转换
 * 国际化数据通过 translateNewsRecord / translateNewsRecords 按需组合获取
 */
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import { db } from "#/db/index";
import { news } from "#/db/schema";
import { DEFAULT_LOCALE, type Locale } from "#/lib/i18n/i18n.types";
import { logger } from "#/lib/logger/logger";
import { getContentTranslations } from "#/server/i18n/i18n.server";

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

	while (true) {
		const conditions = [eq(news.slug, uniqueSlug), isNull(news.deletedAt)];
		if (excludeId) conditions.push(ne(news.id, excludeId));

		const existing = await db.query.news.findFirst({
			where: and(...conditions),
		});

		if (!existing) break;
		uniqueSlug = `${slug}-${counter}`;
		counter++;
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

/** 获取新闻列表 */
export async function getNewsList(params?: {
	status?: string;
	page?: number;
	pageSize?: number;
}) {
	const { status, page = 1, pageSize = 20 } = params ?? {};
	const offset = (page - 1) * pageSize;

	const conditions = [isNull(news.deletedAt)];
	if (status) conditions.push(eq(news.status, status));

	const whereCondition = and(...conditions);

	const [records, total] = await Promise.all([
		db
			.select()
			.from(news)
			.where(whereCondition)
			.orderBy(desc(news.isPinned), desc(news.createdAt))
			.limit(pageSize)
			.offset(offset),
		db.$count(db.select().from(news).where(whereCondition)),
	]);

	return { records, total, page, pageSize };
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
			isNull(news.deletedAt),
		),
	});
	if (!record) return null;

	return { ...record, html: record.content ?? "" };
}

/** 根据 id 获取单条新闻（管理端用） */
export async function getNewsById(id: string): Promise<NewsRecord | null> {
	const record = await db.query.news.findFirst({
		where: and(eq(news.id, id), isNull(news.deletedAt)),
	});
	return record ?? null;
}

/** 创建新闻 */
export async function createNews(params: {
	title: string;
	slug?: string;
	summary?: string;
	content?: string;
	coverImageId?: string;
	status?: string;
	isPinned?: boolean;
	publishedAt?: Date;
	createdBy?: string;
}): Promise<NewsRecord> {
	let slug = params.slug?.trim() || generateSlug(params.title);
	slug = await ensureUniqueSlug(slug);

	const [record] = await db
		.insert(news)
		.values({
			title: params.title,
			slug,
			summary: params.summary,
			content: params.content,
			coverImageId: params.coverImageId,
			status: params.status || "draft",
			isPinned: params.isPinned ?? false,
			publishedAt:
				params.status === "published" ? params.publishedAt || new Date() : null,
			createdBy: params.createdBy,
		})
		.returning();

	logger.info({ title: record.title, slug: record.slug }, "新闻已创建");
	return record;
}

/** 更新新闻 */
export async function updateNews(
	id: string,
	params: {
		title?: string;
		slug?: string;
		summary?: string;
		content?: string;
		coverImageId?: string | null;
		status?: string;
		isPinned?: boolean;
		publishedAt?: Date | null;
		updatedBy?: string;
	},
): Promise<NewsRecord | null> {
	const existing = await getNewsById(id);
	if (!existing) return null;

	let slug = existing.slug;
	if (params.slug && params.slug !== existing.slug) {
		slug = await ensureUniqueSlug(params.slug, id);
	}

	const updateData: Record<string, unknown> = {
		...params,
		slug,
		updatedAt: new Date(),
	};

	// 发布时设置发布时间
	if (params.status === "published" && !existing.publishedAt) {
		updateData.publishedAt = params.publishedAt || new Date();
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

	logger.info({ id, title: existing.title }, "新闻已删除");
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
