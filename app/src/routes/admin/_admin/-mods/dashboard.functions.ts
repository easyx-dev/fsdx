/**
 * 仪表盘 Server Function
 */
import { createServerFn } from "@tanstack/react-start";
import { adminPermGuard } from "#/middleware/admin-auth";
import { ADMIN_PERMISSIONS } from "#/permissions/admin-permissions";
import { getStats } from "#/services/dashboard/dashboard.server";

/** 获取仪表盘统计数据 */
export const getStatsSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(ADMIN_PERMISSIONS.DASHBOARD_VIEW)])
	.handler(async () => {
		return getStats();
	});
