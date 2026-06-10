/**
 * 新闻管理 Server Function 包装器：导出
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toCsv, toJson } from "#/lib/export/export.utils";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { permGuard } from "#/middleware/server-fn-auth";
import {
	getAllNewsForExport,
	NEWS_EXPORT_COLUMNS,
} from "#/server/news/news.server";

const exportSchema = z.object({
	format: z.enum(["csv", "json"]),
});

/** 导出新闻数据（CSV 或 JSON） */
export const exportNewsFn = createServerFn({ method: "GET" })
	.middleware([permGuard(PERMISSIONS.NEWS_EXPORT)])
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
