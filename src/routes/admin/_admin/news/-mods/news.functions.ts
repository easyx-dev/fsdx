/**
 * 新闻路由共享 Server Function
 */
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "#/db/index";
import { news } from "#/db/schema";
import { toCsv, toJson } from "#/lib/export/export.utils";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import {
	changeNewsStatus,
	createNews,
	deleteNews,
	getNewsById,
	getNewsList,
} from "#/server/news/news.server";
import { logOperation } from "#/server/operation-log/operation-log.server";
import { notDeleted } from "#/server/query/query-utils.server";
import {
	createNewsSchema,
	exportSchema,
	getNewsSchema,
	listSchema,
	newsImportSchema,
	statusSchema,
	updateNewsSchema,
} from "./news.schemas";

// ─── 导入辅助 ───

const MAX_RECOMMENDED = 5;

/** 根据标题生成 slug */
export function generateSlug(title: string): string {
	const hasChinese = /[\u4e00-\u9fff]/.test(title);
	if (hasChinese) return `news-${Date.now()}`;
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

// ─── Server Functions ───

/** 获取新闻列表（分页、筛选、排序） */
export const getNewsListSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.NEWS_VIEW)])
	.inputValidator(listSchema)
	.handler(async ({ data: { status, page = 1, sortField, sortOrder } }) => {
		return getNewsList({ status, page, pageSize: 20, sortField, sortOrder });
	});

/** 根据 id 获取单条新闻 */
export const getNewsByIdSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.NEWS_VIEW)])
	.inputValidator(getNewsSchema)
	.handler(async ({ data: { id } }) => {
		return getNewsById(id);
	});

/** 新建新闻 */
export const createNewsSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.NEWS_CREATE)])
	.inputValidator(createNewsSchema)
	.handler(async ({ data, context }) => {
		const record = await createNews({
			...data,
			externalUrl: data.externalUrl || undefined,
			publishedAt: data.publishedAt || undefined,
			sortOrder: data.sortOrder,
			createdById: context.user.id,
		});
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "news",
			action: "create",
			targetType: "news",
			targetId: record.id,
			targetName: record.title,
		});
		return record;
	});

/** 更新新闻 */
export const updateNewsSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.NEWS_EDIT)])
	.inputValidator(updateNewsSchema)
	.handler(async ({ data, context }) => {
		const existing = await getNewsById(data.id);
		if (!existing) return null;

		// 推荐上限校验（不包括当前记录自身）
		if (data.isRecommended && !existing.isRecommended) {
			const recommendedCount = await db.$count(
				db
					.select()
					.from(news)
					.where(
						and(
							eq(news.isRecommended, true),
							notDeleted(news.deletedAt),
							ne(news.id, data.id),
						),
					),
			);
			if (recommendedCount >= MAX_RECOMMENDED) {
				throw new Error(`最多推荐 ${MAX_RECOMMENDED} 条新闻`);
			}
		}

		let slug = existing.slug;
		if (data.slug && data.slug !== existing.slug) {
			slug = await ensureUniqueSlug(data.slug, data.id);
		}

		// 将 publishedAt 字符串转为 Date（前端 DatePicker 传出 ISO 字符串）
		const publishedAtValue =
			data.publishedAt !== undefined
				? data.publishedAt
					? new Date(data.publishedAt)
					: null
				: undefined;

		const updateData: Record<string, unknown> = {
			title: data.title,
			description: data.description,
			content: data.content,
			coverImageId: data.coverImageId,
			externalUrl: data.externalUrl,
			status: data.status,
			isPinned: data.isPinned,
			isRecommended: data.isRecommended,
			sortOrder: data.sortOrder,
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
		} else if (data.status === "published" && !existing.publishedAt) {
			updateData.publishedAt = new Date();
		}

		const [record] = await db
			.update(news)
			.set(updateData)
			.where(eq(news.id, data.id))
			.returning();

		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "news",
			action: "update",
			targetType: "news",
			targetId: data.id,
			targetName: data.title,
		});
		return record ?? null;
	});

/** 删除新闻（软删除） */
export const deleteNewsSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.NEWS_DELETE)])
	.inputValidator(getNewsSchema)
	.handler(async ({ data: { id }, context }) => {
		const newsRecord = await getNewsById(id);
		await deleteNews(id);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "news",
			action: "delete",
			targetType: "news",
			targetId: id,
			targetName: newsRecord?.title ?? id,
		});
		return { success: true };
	});

/** 变更新闻状态（发布/归档） */
export const changeStatusSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.NEWS_PUBLISH)])
	.inputValidator(statusSchema)
	.handler(async ({ data: { id, status }, context }) => {
		const newsRecord = await getNewsById(id);
		const result = await changeNewsStatus(id, status);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "news",
			action: "change_status",
			targetType: "news",
			targetId: id,
			targetName: newsRecord?.title || id,
		});
		return result;
	});

/** 批量导入新闻（按标题去重） */
export const importNewsSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.NEWS_IMPORT)])
	.inputValidator(newsImportSchema)
	.handler(async ({ data, context }) => {
		const newRecommendedCount = data.news.filter((r) => r.isRecommended).length;
		if (newRecommendedCount > 0) {
			const existingRecommended = await db.$count(
				db
					.select()
					.from(news)
					.where(and(eq(news.isRecommended, true), notDeleted(news.deletedAt))),
			);
			if (existingRecommended + newRecommendedCount > MAX_RECOMMENDED) {
				throw new Error(
					`最多推荐 ${MAX_RECOMMENDED} 条新闻（已有 ${existingRecommended} 条，本次导入 ${newRecommendedCount} 条）`,
				);
			}
		}

		let created = 0;
		let skipped = 0;
		for (const row of data.news) {
			const existing = await db.query.news.findFirst({
				where: and(eq(news.title, row.title), notDeleted(news.deletedAt)),
			});
			if (existing) {
				skipped++;
				continue;
			}
			const slug = await ensureUniqueSlug(generateSlug(row.title));
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
				createdById: context.user.id,
			});
			created++;
		}

		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "news",
			action: "import",
			targetType: "news",
			detail: { created },
		});
		return { created, skipped };
	});

/** 新闻导出 CSV 列定义 */
const NEWS_EXPORT_COLUMNS: { key: string; title: string }[] = [
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

/** 导出新闻数据（CSV 或 JSON） */
export const exportNewsSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.NEWS_EXPORT)])
	.inputValidator(exportSchema)
	.handler(async ({ data: { format } }) => {
		const records = await db
			.select()
			.from(news)
			.where(notDeleted(news.deletedAt))
			.orderBy(desc(news.sortOrder), desc(news.createdAt));
		if (format === "csv") {
			return {
				format: "csv" as const,
				content: toCsv(records, NEWS_EXPORT_COLUMNS),
			};
		}
		return { format: "json" as const, content: toJson(records) };
	});
