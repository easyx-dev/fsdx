/**
 * 元属性管理路由共享 Server Function
 */
import { createServerFn } from "@tanstack/react-start";
import { adminPermGuard } from "#/middleware/admin-auth";
import { ADMIN_PERMISSIONS } from "#/permissions/admin-permissions";
import {
	createTrackPropertyMeta,
	deleteTrackPropertyMeta,
	updateTrackPropertyMeta,
} from "#/services/track/track.server";
import {
	propertyMetaCreateSchema,
	propertyMetaDeleteSchema,
	propertyMetaUpdateSchema,
} from "./property-meta.schemas";

/** 元属性支持的数据类型 */
export const PROPERTY_DATA_TYPES = [
	{ label: "string", value: "string" },
	{ label: "number", value: "number" },
	{ label: "boolean", value: "boolean" },
	{ label: "date", value: "date" },
	{ label: "array", value: "array" },
	{ label: "object", value: "object" },
] as const;

/** 创建元属性 */
export const createPropertyMetaSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(ADMIN_PERMISSIONS.TRACK_MANAGE)])
	.inputValidator(propertyMetaCreateSchema)
	.handler(async ({ data }) => {
		const { key, ...input } = data;
		return createTrackPropertyMeta(key, input);
	});

/** 更新元属性 */
export const updatePropertyMetaSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(ADMIN_PERMISSIONS.TRACK_MANAGE)])
	.inputValidator(propertyMetaUpdateSchema)
	.handler(async ({ data }) => {
		const { key, ...input } = data;
		return updateTrackPropertyMeta(key, input);
	});

/** 删除元属性 */
export const deletePropertyMetaSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(ADMIN_PERMISSIONS.TRACK_MANAGE)])
	.inputValidator(propertyMetaDeleteSchema)
	.handler(async ({ data }) => deleteTrackPropertyMeta(data.key));
