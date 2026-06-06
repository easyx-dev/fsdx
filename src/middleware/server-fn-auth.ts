/**
 * Server Function 鉴权与权限中间件
 * 使用 createMiddleware 实现可复用的函数级中间件
 */

import { createMiddleware } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { db } from "#/db/index";
import { COOKIE_NAMES, verifyToken } from "#/lib/jwt";
import { logger } from "#/lib/logger";
import { hasPermission, type PermissionDef } from "#/lib/permissions";

/** 通过中间件注入 handler 的上下文 */
export interface AuthContext {
	user: {
		id: string;
		username: string;
		email: string;
		userType: "admin" | "client";
		isRoot: boolean;
	};
	rolePermissions: string[];
}

/** 鉴权错误 */
export class AuthError extends Error {
	statusCode: number;

	constructor(message: string, statusCode: number) {
		super(message);
		this.statusCode = statusCode;
		this.name = "AuthError";
	}
}

/**
 * 校验管理员登录，将用户信息和角色权限注入 context
 * isRoot 用户自动拥有所有权限，不依赖角色表
 */
export const authGuard = createMiddleware({
	type: "function",
}).server(async ({ next }) => {
	const token = getCookie(COOKIE_NAMES.ACCESS_TOKEN);
	if (!token) {
		throw new AuthError("未登录或登录已过期", 401);
	}

	const jwtPayload = await verifyToken(token);
	if (!jwtPayload) {
		throw new AuthError("未登录或登录已过期", 401);
	}

	if (jwtPayload.userType !== "admin") {
		throw new AuthError("无权访问管理端", 403);
	}

	// 查管理员用户
	const user = await db.query.adminUser.findFirst({
		where: (t, { eq }) => eq(t.id, jwtPayload.userId),
	});

	if (!user || user.deletedAt || user.status !== "active") {
		throw new AuthError("账号已被禁用或删除", 403);
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

	logger.info(
		{ userId: user.id, username: user.username, isRoot: user.isRoot },
		"Server Function 鉴权通过",
	);

	return next({
		context: {
			user: {
				id: user.id,
				username: user.username,
				email: user.email,
				userType: "admin" as const,
				isRoot: user.isRoot,
			},
			rolePermissions,
		} as AuthContext,
	});
});

/**
 * 权限校验中间件工厂
 * 内部组合 authGuard，先验证登录再校验指定权限
 */
export function permGuard(required: PermissionDef) {
	return createMiddleware({ type: "function" })
		.middleware([authGuard])
		.server(async (opts) => {
			const ctx = opts.context as Record<string, unknown> | undefined;
			const rolePermissions = (ctx?.rolePermissions ?? []) as string[];

			if (!hasPermission(rolePermissions, required)) {
				throw new AuthError("权限不足", 403);
			}

			return opts.next();
		});
}
