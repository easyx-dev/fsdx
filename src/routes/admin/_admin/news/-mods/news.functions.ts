/**
 * 新闻路由共享 Server Function
 * edit 页面与抽屉编辑共用，通过 .functions.ts 独立文件导出供路由侧导入
 */

import { createServerFn } from "@tanstack/react-start";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import { createNews, getNewsById, updateNews } from "#/server/news/news.server";
import { logOperation } from "#/server/operation-log/operation-log.server";
import {
	createNewsSchema,
	getNewsSchema,
	updateNewsSchema,
} from "./news.schemas";

/** 根据 id 获取单条新闻 */
export const getNewsByIdFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.NEWS_VIEW)])
	.inputValidator(getNewsSchema)
	.handler(async ({ data: { id } }) => {
		return getNewsById(id);
	});

/** 新建新闻 */
export const createNewsFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.NEWS_CREATE)])
	.inputValidator(createNewsSchema)
	.handler(async ({ data, context }) => {
		const record = await createNews({
			...data,
			publishedAt: data.publishedAt || undefined,
			sort: data.sort,
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
export const updateNewsFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.NEWS_EDIT)])
	.inputValidator(updateNewsSchema)
	.handler(async ({ data, context }) => {
		const record = await updateNews(data.id, {
			...data,
			publishedAt:
				data.publishedAt === null ? null : data.publishedAt || undefined,
			sort: data.sort,
		});
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "news",
			action: "update",
			targetType: "news",
			targetId: data.id,
			targetName: data.title,
		});
		return record;
	});
