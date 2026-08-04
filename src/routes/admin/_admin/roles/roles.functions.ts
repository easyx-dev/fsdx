/**
 * 角色管理路由共享 Server Function
 */
import { createServerFn } from "@tanstack/react-start";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import { logOperation } from "#/services/operation-log/operation-log.server";
import {
	type CreateRoleInput,
	createRole,
	deleteRole,
	getRoleList,
	type UpdateRoleInput,
	updateRole,
} from "#/services/role/role.server";
import {
	idSchema,
	roleCreateSchema,
	roleListSchema,
	roleUpdateSchema,
} from "./roles.schemas";

/** 获取角色列表 */
export const getRolesSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.ROLE_VIEW)])
	.inputValidator(roleListSchema)
	.handler(async ({ data }) => getRoleList(data.keyword));

/** 创建角色 */
export const createRoleSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.ROLE_CREATE)])
	.inputValidator(roleCreateSchema)
	.handler(async ({ data, context }) => {
		const result = await createRole(data as CreateRoleInput);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "role",
			action: "create",
			targetType: "role",
			targetId: result.id,
			targetName: result.name,
		});
		return result;
	});

/** 更新角色 */
export const updateRoleSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.ROLE_EDIT)])
	.inputValidator(roleUpdateSchema)
	.handler(async ({ data, context }) => {
		const result = await updateRole(data.id, data as UpdateRoleInput);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "role",
			action: "update",
			targetType: "role",
			targetId: data.id,
			targetName: result?.name,
		});
		return result;
	});

/** 删除角色 */
export const deleteRoleSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.ROLE_DELETE)])
	.inputValidator(idSchema)
	.handler(async ({ data, context }) => {
		await deleteRole(data.id);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "role",
			action: "delete",
			targetType: "role",
			targetId: data.id,
		});
	});
