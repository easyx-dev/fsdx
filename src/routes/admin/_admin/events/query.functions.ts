/**
 * 埋点事件查询 Server Function
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import { getEventNames, searchEvents } from "#/services/event/event.server";

export const eventQuerySchema = z.object({
	event: z.string().optional(),
	userId: z.string().optional(),
	sessionId: z.string().optional(),
	keyword: z.string().optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	page: z.number().int().min(1).optional(),
	pageSize: z.number().int().min(1).max(100).optional(),
	sortField: z.string().optional(),
	sortOrder: z.enum(["ascend", "descend"]).optional(),
});

/** 分页查询埋点事件 */
export const searchEventsSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.EVENT_QUERY)])
	.inputValidator(eventQuerySchema)
	.handler(async ({ data }) => searchEvents(data));

/** 获取已有的事件名称列表 */
export const getEventNamesSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.EVENT_QUERY)])
	.handler(async () => getEventNames());
