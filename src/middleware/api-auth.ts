/**
 * API 路由鉴权辅助模块
 * 用于 server.handlers.GET 等非 Server Function 场景的 JWT 校验与权限控制
 * 语义与 admin-auth.ts 的 adminAuthGuard / adminPermGuard 对齐
 */
import { getCookie } from "@tanstack/react-start/server";
import { db } from "#/db/index";
import { COOKIE_NAMES, verifyToken } from "#/lib/jwt/jwt";
import {
	hasPermission,
	type PermissionDef,
} from "#/lib/permissions/permissions";

/** API 路由鉴权错误 */
export class ApiAuthError extends Error {
	statusCode: number;

	constructor(message: string, statusCode: number) {
		super(message);
		this.statusCode = statusCode;
		this.name = "ApiAuthError";
	}
}

/** 验证成功返回的管理端用户信息 */
export interface ApiAuthUser {
	id: string;
	username: string;
	email: string;
	isRoot: boolean;
}

/**
 * 验证管理端 API 请求的登录状态
 * 从 Cookie 读取 JWT，校验 token 有效性及用户状态，返回用户信息与角色权限
 */
export async function verifyAdminAuth(): Promise<{
	user: ApiAuthUser;
	rolePermissions: string[];
}> {
	const token = getCookie(COOKIE_NAMES.ADMIN_TOKEN);
	if (!token) {
		throw new ApiAuthError("未登录或登录已过期", 401);
	}

	const jwtPayload = await verifyToken(token);
	if (!jwtPayload) {
		throw new ApiAuthError("未登录或登录已过期", 401);
	}

	if (jwtPayload.userType !== "admin") {
		throw new ApiAuthError("无权访问管理端", 403);
	}

	const user = await db.query.adminUser.findFirst({
		where: (t, { eq }) => eq(t.id, jwtPayload.userId),
	});

	if (!user || user.deletedAt || user.status !== "active") {
		throw new ApiAuthError("账号已被禁用或删除", 403);
	}

	let rolePermissions: string[] = [];
	if (user.isRoot) {
		rolePermissions = ["**"];
	} else {
		const userRole = await db.query.role.findFirst({
			where: (t, { eq }) => eq(t.id, user.roleId),
		});
		rolePermissions = (userRole?.permissions ?? []) as string[];
	}

	return {
		user: {
			id: user.id,
			username: user.username,
			email: user.email,
			isRoot: user.isRoot,
		},
		rolePermissions,
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
