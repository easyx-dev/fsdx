/**
 * 日志查询 Server Function
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminPermGuard } from "#/middleware/admin-auth";
import { ADMIN_PERMISSIONS } from "#/permissions/admin-permissions";
import {
	getLogDates as getLogDatesService,
	searchLogs as searchLogsService,
} from "#/services/logs/logs.server";

export const searchLogsSchema = z.object({
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	keyword: z.string().optional(),
	level: z.string().optional(),
	page: z.number().optional(),
	pageSize: z.number().optional(),
});

export const searchLogsSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(ADMIN_PERMISSIONS.LOG_VIEW)])
	.inputValidator(searchLogsSchema)
	.handler(async ({ data }) => {
		return searchLogsService(data);
	});

export const getDatesSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(ADMIN_PERMISSIONS.LOG_VIEW)])
	.handler(async () => {
		return getLogDatesService();
	});
