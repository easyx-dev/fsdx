/**
 * 管理端角色管理路由共享 Server Function
 */
import { createServerFn } from "@tanstack/react-start";
import { PERMISSIONS } from "#/constants/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import {
	createAdminRole,
	deleteAdminRole,
	getAdminRoleList,
	updateAdminRole,
} from "#/services/admin-role/admin-role.server";
import { logCrud } from "#/services/operation-log/operation-log.server";
import {
	adminRoleCreateSchema,
	adminRoleListSchema,
	adminRoleUpdateSchema,
	idSchema,
} from "./admin-roles.schemas";

/** 获取角色列表 */
export const getAdminRolesSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.ADMIN_ROLE_VIEW)])
	.inputValidator(adminRoleListSchema)
	.handler(async ({ data }) => getAdminRoleList(data.keyword));

/** 创建角色 */
export const createAdminRoleSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.ADMIN_ROLE_CREATE)])
	.inputValidator(adminRoleCreateSchema)
	.handler(async ({ data, context }) => {
		const result = await createAdminRole(data);
		logCrud(context.user, "admin_role", "create", {
			id: result.id,
			name: result.name,
		});
		return result;
	});

/** 更新角色 */
export const updateAdminRoleSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.ADMIN_ROLE_EDIT)])
	.inputValidator(adminRoleUpdateSchema)
	.handler(async ({ data, context }) => {
		const result = await updateAdminRole(data.id, data);
		logCrud(context.user, "admin_role", "update", {
			id: data.id,
			name: result?.name,
		});
		return result;
	});

/** 删除角色 */
export const deleteAdminRoleSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.ADMIN_ROLE_DELETE)])
	.inputValidator(idSchema)
	.handler(async ({ data, context }) => {
		await deleteAdminRole(data.id);
		logCrud(context.user, "admin_role", "delete", { id: data.id });
	});
