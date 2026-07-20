/**
 * 新闻管理 Server Function 包装器：导出
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toCsv, toJson } from "#/lib/export/export.utils";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import {
	getAllNewsForExport,
	getRecommendedNews,
	NEWS_EXPORT_COLUMNS,
} from "#/server/news/news.server";

const exportSchema = z.object({
	format: z.enum(["csv", "json"]),
});

/** 导出新闻数据（CSV 或 JSON） */
export const exportNewsSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.NEWS_EXPORT)])
	.inputValidator(exportSchema)
	.handler(async ({ data: { format } }) => {
		const records = await getAllNewsForExport();
		if (format === "csv") {
			return {
				format: "csv" as const,
				content: toCsv(records, NEWS_EXPORT_COLUMNS),
			};
		}
		return { format: "json" as const, content: toJson(records) };
	});

/** 获取首页推荐新闻（客户端前台调用，无需鉴权） */
export const getRecommendedNewsSFn = createServerFn({ method: "GET" }).handler(
	async () => {
		return getRecommendedNews();
	},
);
