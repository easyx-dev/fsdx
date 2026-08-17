/**
 * 埋点事件查询 Server Function
 */

import { DATE_ONLY_REGEX, isValidDateStr } from "@fsdx/core/date-format";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminPermGuard } from "#/middleware/admin-auth";
import { ADMIN_PERMISSIONS } from "#/permissions/admin-permissions";
import {
	getTrackEventNames,
	searchTrackEvents,
} from "#/services/track/track.server";

export const trackEventQuerySchema = z.object({
	name: z.string().optional(),
	userId: z.string().optional(),
	sessionId: z.string().optional(),
	keyword: z.string().optional(),
	startDate: z
		.string()
		.regex(DATE_ONLY_REGEX)
		.refine(isValidDateStr)
		.optional(),
	endDate: z.string().regex(DATE_ONLY_REGEX).refine(isValidDateStr).optional(),
	page: z.number().int().min(1).optional(),
	pageSize: z.number().int().min(1).max(100).optional(),
	sortField: z.string().optional(),
	sortOrder: z.enum(["ascend", "descend"]).optional(),
});

/** 分页查询埋点事件 */
export const searchTrackEventsSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(ADMIN_PERMISSIONS.TRACK_QUERY)])
	.validator(trackEventQuerySchema)
	.handler(async ({ data }) => searchTrackEvents(data));

/** 获取已有的事件名称列表 */
export const getTrackEventNamesSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(ADMIN_PERMISSIONS.TRACK_QUERY)])
	.handler(async () => getTrackEventNames());
