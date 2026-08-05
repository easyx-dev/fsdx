/**
 * API 路由鉴权辅助模块
 * 用于 server.handlers.GET 等非 Server Function 场景的 JWT 校验与权限控制
 * 复用 admin-auth.ts 的 resolveAdminAuthContext 核心逻辑，仅将中间件上下文转为普通函数返回值
 */
import { getCookie } from "@tanstack/react-start/server";
import { COOKIE_NAMES } from "#/constants/cookie-names";
import {
	hasPermission,
	type PermissionDef,
} from "#/constants/permissions/permissions";
import { AdminAuthError, resolveAdminAuthContext } from "./admin-auth";

/** API 路由鉴权错误（兼容旧调用方，继承 AdminAuthError 语义） */
export class ApiAuthError extends AdminAuthError {}

/** 验证成功返回的管理端用户信息 */
export interface ApiAuthUser {
	id: string;
	username: string;
	email: string;
	isRoot: boolean;
}

/**
 * 验证管理端 API 请求的登录状态
 * 从 Cookie 读取 JWT，复用 resolveAdminAuthContext 校验身份，返回用户信息与角色权限
 */
export async function verifyAdminAuth(): Promise<{
	user: ApiAuthUser;
	rolePermissions: string[];
}> {
	const token = getCookie(COOKIE_NAMES.ADMIN_TOKEN);
	const ctx = await resolveAdminAuthContext(token);
	return {
		user: {
			id: ctx.user.id,
			username: ctx.user.username,
			email: ctx.user.email,
			isRoot: ctx.user.isRoot,
		},
		rolePermissions: ctx.rolePermissions,
	};
}

/**
 * 验证管理端 API 请求的登录状态并校验指定权限
 * 内部组合 verifyAdminAuth，先验证登录再校验权限
 */
export async function verifyAdminPerm(required: PermissionDef): Promise<void> {
	const { rolePermissions } = await verifyAdminAuth();
	if (!hasPermission(rolePermissions, required)) {
		throw new ApiAuthError("权限不足", 403);
	}
}
