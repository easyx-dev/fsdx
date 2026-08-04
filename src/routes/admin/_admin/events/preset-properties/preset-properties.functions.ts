/**
 * 预设属性管理路由共享 Server Function
 */
import { createServerFn } from "@tanstack/react-start";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import {
	createPresetProperty,
	deletePresetProperty,
	updatePresetProperty,
} from "#/services/event/event.server";
import {
	presetPropertyCreateSchema,
	presetPropertyDeleteSchema,
	presetPropertyUpdateSchema,
} from "./preset-properties.schemas";

/** 预设属性支持的数据类型 */
export const PROPERTY_DATA_TYPES = [
	{ label: "string", value: "string" },
	{ label: "number", value: "number" },
	{ label: "boolean", value: "boolean" },
	{ label: "date", value: "date" },
	{ label: "array", value: "array" },
	{ label: "object", value: "object" },
] as const;

/** 创建预设属性 */
export const createPresetPropertySFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.EVENT_MANAGE)])
	.inputValidator(presetPropertyCreateSchema)
	.handler(async ({ data }) => {
		const { key, ...input } = data;
		return createPresetProperty(key, input);
	});

/** 更新预设属性 */
export const updatePresetPropertySFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.EVENT_MANAGE)])
	.inputValidator(presetPropertyUpdateSchema)
	.handler(async ({ data }) => {
		const { key, ...input } = data;
		return updatePresetProperty(key, input);
	});

/** 删除预设属性 */
export const deletePresetPropertySFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.EVENT_MANAGE)])
	.inputValidator(presetPropertyDeleteSchema)
	.handler(async ({ data }) => deletePresetProperty(data.key));
