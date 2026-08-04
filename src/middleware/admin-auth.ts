/**
 * 管理端 Server Function 鉴权与权限中间件
 * 使用 createMiddleware 实现可复用的函数级中间件
 */

import { createMiddleware } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { db } from "#/db/index";
import { COOKIE_NAMES, verifyToken } from "#/lib/jwt/jwt";
import {
	hasPermission,
	type PermissionDef,
} from "#/lib/permissions/permissions";
import { runWithRequestContext } from "#/lib/request-context/request-context";

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
 * 管理端登录校验中间件：读取管理端 Cookie，校验 JWT，将用户信息和角色权限注入 context
 * isRoot 用户自动拥有所有权限，不依赖角色表
 */
export const adminAuthGuard = createMiddleware({
	type: "function",
}).server(async ({ next }) => {
	const token = getCookie(COOKIE_NAMES.ADMIN_TOKEN);
	if (!token) {
		throw new AdminAuthError("未登录或登录已过期", 401);
	}

	const jwtPayload = await verifyToken(token);
	if (!jwtPayload) {
		throw new AdminAuthError("未登录或登录已过期", 401);
	}

	if (jwtPayload.userType !== "admin") {
		throw new AdminAuthError("无权访问管理端", 403);
	}

	// 查管理员用户
	const user = await db.query.adminUser.findFirst({
		where: (t, { eq }) => eq(t.id, jwtPayload.userId),
	});

	if (!user || user.deletedAt || user.status !== "active") {
		throw new AdminAuthError("账号已被禁用或删除", 403);
	}

	// Root 用户自动拥有全部权限，无需查询角色表
	let rolePermissions: string[] = [];
	if (user.isRoot) {
		rolePermissions = ["**"];
	} else {
		const userRole = await db.query.role.findFirst({
			where: (t, { eq }) => eq(t.id, user.roleId),
		});
		rolePermissions = (userRole?.permissions ?? []) as string[];
	}

	// 将操作者身份注入请求上下文（AsyncLocalStorage），供审计日志等下游读取
	return runWithRequestContext(
		{
			operator: {
				id: user.id,
				username: user.username,
				email: user.email,
				type: "admin" as const,
			},
		},
		() =>
			next({
				context: {
					user: {
						id: user.id,
						username: user.username,
						email: user.email,
						userType: "admin" as const,
						isRoot: user.isRoot,
					},
					rolePermissions,
				} as AdminAuthContext,
			}),
	);
});

/**
 * 管理端权限校验中间件工厂
 * 内部组合 adminAuthGuard，先验证登录再校验指定权限
 */
export function adminPermGuard(required: PermissionDef) {
	return createMiddleware({ type: "function" })
		.middleware([adminAuthGuard])
		.server(async (opts) => {
			const ctx = opts.context as Partial<AdminAuthContext> | undefined;
			const rolePermissions = ctx?.rolePermissions ?? [];

			if (!hasPermission(rolePermissions, required)) {
				throw new AdminAuthError("权限不足", 403);
			}

			return opts.next();
		});
}
