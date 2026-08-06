/**
 * 新闻路由共享 Server Function
 */
import { createServerFn } from "@tanstack/react-start";
import { adminPermGuard } from "#/middleware/admin-auth";
import { PERMISSIONS } from "#/permissions/permissions";
import {
	changeNewsStatus,
	createNews,
	deleteNews,
	getNewsById,
	getNewsList,
} from "#/services/news/news.server";
import { logCrud } from "#/services/operation-log/operation-log.server";
import {
	createNewsSchema,
	exportSchema,
	getNewsSchema,
	listSchema,
	newsImportSchema,
	statusSchema,
	updateNewsSchema,
} from "./news.schemas";
import {
	checkRecommendedLimit,
	ensureUniqueSlug,
	exportAllNews,
	formatNewsExport,
	importNewsItems,
	type NewsUpdateData,
	updateNewsRecord,
} from "./news.server";

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
		logCrud(context.user, "news", "create", {
			id: record.id,
			name: record.title,
		});
		return record;
	});

/** 更新新闻 */
export const updateNewsSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.NEWS_EDIT)])
	.inputValidator(updateNewsSchema)
	.handler(async ({ data, context }) => {
		const existing = await getNewsById(data.id);
		if (!existing) throw new Error("新闻不存在或已被删除");

		if (data.isRecommended && !existing.isRecommended) {
			await checkRecommendedLimit(data.id);
		}

		let slug = existing.slug;
		if (data.slug && data.slug !== existing.slug) {
			slug = await ensureUniqueSlug(data.slug, data.id);
		}

		const publishedAtValue =
			data.publishedAt !== undefined
				? data.publishedAt
					? new Date(data.publishedAt)
					: null
				: undefined;

		const updateData: NewsUpdateData = {
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
		};

		for (const key of Object.keys(updateData)) {
			if (updateData[key as keyof NewsUpdateData] === undefined)
				delete updateData[key as keyof NewsUpdateData];
		}

		if (publishedAtValue !== undefined) {
			updateData.publishedAt = publishedAtValue;
		} else if (data.status === "published" && !existing.publishedAt) {
			updateData.publishedAt = new Date();
		}

		const record = await updateNewsRecord(data.id, updateData);

		logCrud(context.user, "news", "update", { id: data.id, name: data.title });
		return record ?? null;
	});

/** 删除新闻（软删除） */
export const deleteNewsSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.NEWS_DELETE)])
	.inputValidator(getNewsSchema)
	.handler(async ({ data: { id }, context }) => {
		const newsRecord = await getNewsById(id);
		await deleteNews(id);
		logCrud(context.user, "news", "delete", {
			id: id,
			name: newsRecord?.title ?? id,
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
		logCrud(context.user, "news", "change_status", {
			id: id,
			name: newsRecord?.title || id,
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
			await checkRecommendedLimit(undefined, newRecommendedCount);
		}

		const { created, skipped } = await importNewsItems(
			data.news,
			context.user.id,
		);

		logCrud(context.user, "news", "import", undefined, { detail: { created } });
		return { created, skipped };
	});

/** 导出新闻数据（CSV 或 JSON） */
export const exportNewsSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.NEWS_EXPORT)])
	.inputValidator(exportSchema)
	.handler(async ({ data: { format } }) => {
		const records = await exportAllNews();
		return formatNewsExport(records, format);
	});
