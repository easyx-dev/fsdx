/**
 * 管理端鉴权中间件：登录校验 + 权限控制
 * 统一为 request middleware，同时支持 Server Function 和 Server Route
 */

import { runWithRequestContext } from "@fsdx/core/request-context";
import { createMiddleware } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { COOKIE_NAMES } from "#/constants/cookie-names";
import {
	type AdminPermissionDef,
	hasAdminPermission,
} from "#/permissions/admin-permissions";

/** 通过中间件注入 handler 的管理端鉴权上下文 */
export interface AdminAuthContext {
	user: {
		id: string;
		username: string;
		email: string;
		userType: "admin";
		isRoot: boolean;
	};
	rolePermissions: string[];
}

/** 管理端鉴权错误 */
export class AdminAuthError extends Error {
	statusCode: number;

	constructor(message: string, statusCode: number) {
		super(message);
		this.statusCode = statusCode;
		this.name = "AdminAuthError";
	}
}

/**
 * 管理端登录校验中间件：读取管理端 Cookie，调用 resolveAdminAuthContext 校验身份
 * 适用场景：仅需认证不需权限码的接口
 */
export const adminAuthGuard = createMiddleware().server(async ({ next }) => {
	const token = getCookie(COOKIE_NAMES.ADMIN_TOKEN);
	const { resolveAdminAuthContext } = await import(
		"#/middleware/admin-auth.server"
	);
	const ctx = await resolveAdminAuthContext(token);
	return runWithRequestContext(
		{
			operator: {
				id: ctx.user.id,
				username: ctx.user.username,
				email: ctx.user.email,
				type: "admin",
			},
		},
		() => next({ context: ctx }),
	);
});

/**
 * 管理端权限校验中间件工厂
 * 直接调用 resolveAdminAuthContext 完成登录校验和权限校验
 * Server Function 和 Server Route 通用
 */
export function adminPermGuard(required: AdminPermissionDef) {
	return createMiddleware().server(async ({ next }) => {
		const token = getCookie(COOKIE_NAMES.ADMIN_TOKEN);
		const { resolveAdminAuthContext } = await import(
			"#/middleware/admin-auth.server"
		);
		const ctx = await resolveAdminAuthContext(token);
		if (!hasAdminPermission(ctx.rolePermissions, required)) {
			throw new AdminAuthError("权限不足", 403);
		}
		return runWithRequestContext(
			{
				operator: {
					id: ctx.user.id,
					username: ctx.user.username,
					email: ctx.user.email,
					type: "admin",
				},
			},
			() => next({ context: ctx }),
		);
	});
}

/**
 * Server Route 专用权限守卫
 * 组合 adminPermGuard，捕获 AdminAuthError 转为对应 HTTP 状态码 JSON，避免中间件抛错被框架统一转 500
 */
export function adminPermRouteGuard(required: AdminPermissionDef) {
	const guard = adminPermGuard(required);
	return createMiddleware()
		.middleware([guard])
		.server(async ({ next }) => {
			try {
				return await next();
			} catch (err) {
				if (err instanceof AdminAuthError) {
					return new Response(JSON.stringify({ error: err.message }), {
						status: err.statusCode,
						headers: { "Content-Type": "application/json" },
					});
				}
				throw err;
			}
		});
}
