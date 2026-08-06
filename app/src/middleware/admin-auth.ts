/**
 * 管理端鉴权中间件：登录校验 + 权限控制
 * 统一为 request middleware，同时支持 Server Function 和 Server Route
 */

import { runWithRequestContext } from "@fsdx/core/request-context";
import { createMiddleware } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { COOKIE_NAMES } from "#/constants/cookie-names";
import { jwt } from "#/lib/jwt/jwt";
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
 * 管理端鉴权核心逻辑：校验 token 并返回用户上下文
 * 不涉及 Cookie 读取，由中间件层传入
 * isRoot 用户自动拥有所有权限，不依赖角色表
 *
 * ⚠️ 注意：本函数及其调用的 guard 只能从服务端可达路径调用（SFn handler / Server Route / 其他 .server 模块）。
 * 若从客户端可达的组件/hook 调用，会触发 import protection（.server 依赖泄漏到客户端构建）。
 * 服务层采用动态 import，依赖树摇移除客户端动态 import 才不报错——不要在客户端上下文使用本函数。
 */
export async function resolveAdminAuthContext(
	token: string | undefined,
): Promise<AdminAuthContext> {
	if (!token) {
		throw new AdminAuthError("未登录或登录已过期", 401);
	}

	const jwtPayload = await jwt.verifyToken(token);
	if (!jwtPayload) {
		throw new AdminAuthError("未登录或登录已过期", 401);
	}

	if (jwtPayload.userType !== "admin") {
		throw new AdminAuthError("无权访问管理端", 403);
	}

	// 动态 import 服务层：中间件仅服务端执行，客户端 RPC stub 不加载 .server 依赖
	const { getAdminUserForAuth } = await import(
		"#/services/admin-auth/admin-auth.server"
	);
	const result = await getAdminUserForAuth(jwtPayload.userId);
	if (!result.success) {
		if (result.reason === "not_found") {
			throw new AdminAuthError("用户不存在", 401);
		}
		throw new AdminAuthError("账号已被禁用或删除", 403);
	}

	return {
		user: {
			id: result.id,
			username: result.username,
			email: result.email,
			userType: "admin" as const,
			isRoot: result.isRoot,
		},
		rolePermissions: result.rolePermissions,
	};
}

/**
 * 管理端登录校验中间件：读取管理端 Cookie，调用 resolveAdminAuthContext 校验身份
 * 适用场景：仅需认证不需权限码的接口
 */
export const adminAuthGuard = createMiddleware().server(async ({ next }) => {
	const token = getCookie(COOKIE_NAMES.ADMIN_TOKEN);
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
