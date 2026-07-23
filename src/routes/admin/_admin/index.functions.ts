/**
 * 仪表盘 Server Function
 */
import { createServerFn } from "@tanstack/react-start";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import { getStats } from "./index.server";

export interface DashboardStats {
	newsTotal: number;
	publishedNews: number;
	adminTotal: number;
	clientTotal: number;
	storageTotal: number;
}

export const getStatsSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.DASHBOARD_VIEW)])
	.handler(async () => {
		return getStats();
	});
