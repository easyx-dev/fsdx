/**
 * 管理员路由共享 Server Function
 */
import { createServerFn } from "@tanstack/react-start";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import { logOperation } from "#/services/operation-log/operation-log.server";
import { getRoleList as getRoleListService } from "#/services/role/role.server";
import {
	createSchema,
	idSchema,
	listSchema,
	resetPwdSchema,
	updateSchema,
} from "./admins.schemas";
import {
	type AdminUserListParams,
	type CreateAdminUserInput,
	createAdminUser,
	deleteAdminUser,
	getAdminUser,
	getAdminUserList,
	resetAdminPassword,
	type UpdateAdminUserInput,
	updateAdminUser,
} from "./admins.server";

/** 获取角色下拉列表 */
export const getRolesForSelectSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.ADMIN_VIEW)])
	.handler(async () => getRoleListService());

/** 获取管理员列表（分页、筛选、排序） */
export const getListSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.ADMIN_VIEW)])
	.inputValidator(listSchema)
	.handler(async ({ data }) => getAdminUserList(data as AdminUserListParams));

/** 新建管理员 */
export const createSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.ADMIN_CREATE)])
	.inputValidator(createSchema)
	.handler(async ({ data, context }) => {
		const record = await createAdminUser(data as CreateAdminUserInput);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "admin",
			action: "create",
			targetType: "admin_user",
			targetId: record.id,
			targetName: record.username,
		});
		return record;
	});

/** 更新管理员 */
export const updateSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.ADMIN_EDIT)])
	.inputValidator(updateSchema)
	.handler(async ({ data, context }) => {
		const result = await updateAdminUser(data.id, data as UpdateAdminUserInput);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "admin",
			action: "update",
			targetType: "admin_user",
			targetId: data.id,
			targetName: result?.username || data.id,
		});
		return result;
	});

/** 删除管理员（软删除） */
export const deleteSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.ADMIN_DELETE)])
	.inputValidator(idSchema)
	.handler(async ({ data, context }) => {
		const existing = await getAdminUser(data.id);
		const result = await deleteAdminUser(data.id, context.user.id);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "admin",
			action: "delete",
			targetType: "admin_user",
			targetId: data.id,
			targetName: existing?.username || data.id,
		});
		return result;
	});

/** 重置管理员密码 */
export const resetPwdSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.ADMIN_EDIT)])
	.inputValidator(resetPwdSchema)
	.handler(async ({ data, context }) => {
		const existing = await getAdminUser(data.id);
		const result = await resetAdminPassword(data.id, data.password);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "admin",
			action: "reset_pwd",
			targetType: "admin_user",
			targetId: data.id,
			targetName: existing?.username || data.id,
		});
		return result;
	});
