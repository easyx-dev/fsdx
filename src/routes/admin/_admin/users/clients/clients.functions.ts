/**
 * 客户端用户路由共享 Server Function
 */
import { createServerFn } from "@tanstack/react-start";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import { logOperation } from "#/server/operation-log/operation-log.server";
import {
	createSchema,
	idSchema,
	listSchema,
	resetPwdSchema,
	updateSchema,
} from "./clients.schemas";
import {
	type ClientUserListParams,
	type CreateClientUserInput,
	createClientUser,
	deleteClientUser,
	getClientUser,
	getClientUserList,
	resetClientPassword,
	type UpdateClientUserInput,
	updateClientUser,
} from "./clients.server";

/** 获取客户端用户列表（分页、筛选、排序） */
export const getListSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.CLIENT_VIEW)])
	.inputValidator(listSchema)
	.handler(async ({ data }) => getClientUserList(data as ClientUserListParams));

/** 新建客户端用户 */
export const createSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.CLIENT_CREATE)])
	.inputValidator(createSchema)
	.handler(async ({ data, context }) => {
		const record = await createClientUser(data as CreateClientUserInput);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "client",
			action: "create",
			targetType: "client_user",
			targetId: record.id,
			targetName: record.username,
		});
		return record;
	});

/** 更新客户端用户信息 */
export const updateSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.CLIENT_EDIT)])
	.inputValidator(updateSchema)
	.handler(async ({ data, context }) => {
		const result = await updateClientUser(
			data.id,
			data as UpdateClientUserInput,
		);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "client",
			action: "update",
			targetType: "client_user",
			targetId: data.id,
			targetName: result?.username || data.id,
		});
		return result;
	});

/** 删除客户端用户（软删除） */
export const deleteSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.CLIENT_DELETE)])
	.inputValidator(idSchema)
	.handler(async ({ data, context }) => {
		const existing = await getClientUser(data.id);
		const result = await deleteClientUser(data.id);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "client",
			action: "delete",
			targetType: "client_user",
			targetId: data.id,
			targetName: existing?.username || data.id,
		});
		return result;
	});

/** 重置客户端用户密码 */
export const resetPwdSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.CLIENT_EDIT)])
	.inputValidator(resetPwdSchema)
	.handler(async ({ data, context }) => {
		const existing = await getClientUser(data.id);
		const result = await resetClientPassword(data.id, data.password);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "client",
			action: "reset_pwd",
			targetType: "client_user",
			targetId: data.id,
			targetName: existing?.username || data.id,
		});
		return result;
	});
