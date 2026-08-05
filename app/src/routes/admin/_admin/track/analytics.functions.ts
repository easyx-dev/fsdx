/**
 * 事件分析 Server Function
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PERMISSIONS } from "#/constants/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import { getTrackAnalytics } from "#/services/track/track.server";

export const analyticsQuerySchema = z.object({
	startDate: z.string().min(1),
	endDate: z.string().min(1),
	granularity: z.enum(["hour", "day"]).optional(),
});

/** 获取事件分析数据 */
export const getTrackAnalyticsSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.TRACK_QUERY)])
	.inputValidator(analyticsQuerySchema)
	.handler(async ({ data }) => getTrackAnalytics(data));
