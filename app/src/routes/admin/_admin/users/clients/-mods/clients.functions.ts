/**
 * 客户端用户路由共享 Server Function
 */
import { createServerFn } from "@tanstack/react-start";
import { adminPermGuard } from "#/middleware/admin-auth";
import { ADMIN_PERMISSIONS } from "#/permissions/admin-permissions";
import { getClientRoleList } from "#/services/client-role/client-role.server";
import { logCrud } from "#/services/operation-log/operation-log.server";
import {
	createSchema,
	idSchema,
	listSchema,
	resetPwdSchema,
	updateSchema,
} from "./clients.schemas";
import {
	createClientUser,
	deleteClientUser,
	getClientUser,
	getClientUserList,
	resetClientPassword,
	updateClientUser,
} from "./clients.server";

/** 获取客户端角色下拉列表 */
export const getClientRolesForSelectSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(ADMIN_PERMISSIONS.CLIENT_VIEW)])
	.handler(async () => getClientRoleList());

/** 获取客户端用户列表（分页、筛选、排序） */
export const getListSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(ADMIN_PERMISSIONS.CLIENT_VIEW)])
	.inputValidator(listSchema)
	.handler(async ({ data }) => getClientUserList(data));

/** 新建客户端用户 */
export const createSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(ADMIN_PERMISSIONS.CLIENT_CREATE)])
	.inputValidator(createSchema)
	.handler(async ({ data, context }) => {
		const record = await createClientUser(data);
		logCrud(
			context.user,
			"client",
			"create",
			{ id: record.id, name: record.username },
			{ targetType: "client_user" },
		);
		return record;
	});

/** 更新客户端用户信息 */
export const updateSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(ADMIN_PERMISSIONS.CLIENT_EDIT)])
	.inputValidator(updateSchema)
	.handler(async ({ data, context }) => {
		const result = await updateClientUser(data.id, data);
		logCrud(
			context.user,
			"client",
			"update",
			{ id: data.id, name: result?.username || data.id },
			{ targetType: "client_user" },
		);
		return result;
	});

/** 删除客户端用户（软删除） */
export const deleteSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(ADMIN_PERMISSIONS.CLIENT_DELETE)])
	.inputValidator(idSchema)
	.handler(async ({ data, context }) => {
		const existing = await getClientUser(data.id);
		const result = await deleteClientUser(data.id);
		logCrud(
			context.user,
			"client",
			"delete",
			{ id: data.id, name: existing?.username || data.id },
			{ targetType: "client_user" },
		);
		return result;
	});

/** 重置客户端用户密码 */
export const resetPwdSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(ADMIN_PERMISSIONS.CLIENT_EDIT)])
	.inputValidator(resetPwdSchema)
	.handler(async ({ data, context }) => {
		const existing = await getClientUser(data.id);
		const result = await resetClientPassword(data.id, data.password);
		logCrud(
			context.user,
			"client",
			"reset_pwd",
			{ id: data.id, name: existing?.username || data.id },
			{ targetType: "client_user" },
		);
		return result;
	});
