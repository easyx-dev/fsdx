/**
 * 元事件管理路由共享 Server Function
 */
import { createServerFn } from "@tanstack/react-start";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import {
	createTrackEventMeta,
	deleteTrackEventMeta,
	updateTrackEventMeta,
} from "#/services/track/track.server";
import {
	eventMetaCreateSchema,
	eventMetaDeleteSchema,
	eventMetaUpdateSchema,
} from "./event-meta.schemas";

/** 创建元事件 */
export const createEventMetaSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.TRACK_MANAGE)])
	.inputValidator(eventMetaCreateSchema)
	.handler(async ({ data }) => {
		const { name, ...input } = data;
		return createTrackEventMeta(name, input);
	});

/** 更新元事件 */
export const updateEventMetaSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.TRACK_MANAGE)])
	.inputValidator(eventMetaUpdateSchema)
	.handler(async ({ data }) => {
		const { name, ...input } = data;
		return updateTrackEventMeta(name, input);
	});

/** 删除元事件 */
export const deleteEventMetaSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.TRACK_MANAGE)])
	.inputValidator(eventMetaDeleteSchema)
	.handler(async ({ data }) => deleteTrackEventMeta(data.name));
