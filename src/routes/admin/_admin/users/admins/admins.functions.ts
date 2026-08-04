/**
 * 管理员路由共享 Server Function
 */
import { createServerFn } from "@tanstack/react-start";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import { getAdminRoleList } from "#/services/admin-role/admin-role.server";
import { logCrud } from "#/services/operation-log/operation-log.server";
import {
	createSchema,
	idSchema,
	listSchema,
	resetPwdSchema,
	updateSchema,
} from "./admins.schemas";
import {
	createAdminUser,
	deleteAdminUser,
	getAdminUser,
	getAdminUserList,
	resetAdminPassword,
	updateAdminUser,
} from "./admins.server";

/** 获取角色下拉列表 */
export const getAdminRolesForSelectSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.ADMIN_VIEW)])
	.handler(async () => getAdminRoleList());

/** 获取管理员列表（分页、筛选、排序） */
export const getListSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.ADMIN_VIEW)])
	.inputValidator(listSchema)
	.handler(async ({ data }) => getAdminUserList(data));

/** 新建管理员 */
export const createSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.ADMIN_CREATE)])
	.inputValidator(createSchema)
	.handler(async ({ data, context }) => {
		const record = await createAdminUser(data);
		logCrud(
			context.user,
			"admin",
			"create",
			{ id: record.id, name: record.username },
			{ targetType: "admin_user" },
		);
		return record;
	});

/** 更新管理员 */
export const updateSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.ADMIN_EDIT)])
	.inputValidator(updateSchema)
	.handler(async ({ data, context }) => {
		const result = await updateAdminUser(data.id, data);
		logCrud(
			context.user,
			"admin",
			"update",
			{ id: data.id, name: result?.username || data.id },
			{ targetType: "admin_user" },
		);
		return result;
	});

/** 删除管理员（软删除） */
export const deleteSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.ADMIN_DELETE)])
	.inputValidator(idSchema)
	.handler(async ({ data, context }) => {
		const existing = await getAdminUser(data.id);
		const result = await deleteAdminUser(data.id, context.user.id);
		logCrud(
			context.user,
			"admin",
			"delete",
			{ id: data.id, name: existing?.username || data.id },
			{ targetType: "admin_user" },
		);
		return result;
	});

/** 重置管理员密码 */
export const resetPwdSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.ADMIN_EDIT)])
	.inputValidator(resetPwdSchema)
	.handler(async ({ data, context }) => {
		const existing = await getAdminUser(data.id);
		const result = await resetAdminPassword(data.id, data.password);
		logCrud(
			context.user,
			"admin",
			"reset_pwd",
			{ id: data.id, name: existing?.username || data.id },
			{ targetType: "admin_user" },
		);
		return result;
	});
