/**
 * 事件分析 Server Function
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminPermGuard } from "#/middleware/admin-auth";
import { ADMIN_PERMISSIONS } from "#/permissions/admin-permissions";
import { getTrackAnalytics } from "#/services/track/track.server";

export const analyticsQuerySchema = z.object({
	startDate: z.string().min(1),
	endDate: z.string().min(1),
	granularity: z.enum(["hour", "day"]).optional(),
});

/** 获取事件分析数据 */
export const getTrackAnalyticsSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(ADMIN_PERMISSIONS.TRACK_QUERY)])
	.validator(analyticsQuerySchema)
	.handler(async ({ data }) => getTrackAnalytics(data));
