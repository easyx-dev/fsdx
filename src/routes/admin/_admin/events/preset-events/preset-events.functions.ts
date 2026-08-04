/**
 * 预设事件管理路由共享 Server Function
 */
import { createServerFn } from "@tanstack/react-start";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import {
	createPresetEvent,
	deletePresetEvent,
	updatePresetEvent,
} from "#/services/event/event.server";
import {
	presetEventCreateSchema,
	presetEventDeleteSchema,
	presetEventUpdateSchema,
} from "./preset-events.schemas";

/** 创建预设事件 */
export const createPresetEventSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.EVENT_MANAGE)])
	.inputValidator(presetEventCreateSchema)
	.handler(async ({ data }) => {
		const { name, ...input } = data;
		return createPresetEvent(name, input);
	});

/** 更新预设事件 */
export const updatePresetEventSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.EVENT_MANAGE)])
	.inputValidator(presetEventUpdateSchema)
	.handler(async ({ data }) => {
		const { name, ...input } = data;
		return updatePresetEvent(name, input);
	});

/** 删除预设事件 */
export const deletePresetEventSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.EVENT_MANAGE)])
	.inputValidator(presetEventDeleteSchema)
	.handler(async ({ data }) => deletePresetEvent(data.name));
