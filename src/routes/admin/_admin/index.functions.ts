/**
 * 仪表盘 Server Function
 */
import { createServerFn } from "@tanstack/react-start";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import { getStats } from "./stats.server";

export const getStatsSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.DASHBOARD_VIEW)])
	.handler(async () => {
		return getStats();
	});
