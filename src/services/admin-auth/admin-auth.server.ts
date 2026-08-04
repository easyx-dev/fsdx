/**
 * 管理员登录与当前管理员查询核心逻辑（纯函数）
 */

import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { db } from "#/db/index";
import { adminUser } from "#/db/schema";
import {
	adminUserCache,
	type CachedAdminUser,
} from "#/lib/cache/admin-user.cache";
import { type JwtPayload, signToken, verifyToken } from "#/lib/jwt/jwt";
import { logger } from "#/lib/logger/logger";
import type {
	AdminLoginResult,
	AdminUser,
} from "#/services/admin-auth/admin-auth.types";

/** 查询管理端角色权限列表（未分配角色时返回空） */
async function getAdminRolePermissions(
	adminRoleId: string | null,
): Promise<string[]> {
	if (!adminRoleId) return [];
	const roleRecord = await db.query.adminRole.findFirst({
		where: (t, { eq: e, isNull: n }) =>
			and(e(t.id, adminRoleId), n(t.deletedAt)),
	});
	return (roleRecord?.permissions as string[]) ?? [];
}

/**
 * 管理员登录逻辑：验证用户名密码，签发 JWT
 * 调用方（路由 SF）负责设置 Cookie
 */
export async function adminLogin(
	username: string,
	password: string,
): Promise<AdminLoginResult> {
	const user = await db.query.adminUser.findFirst({
		where: (t, { eq: e }) => e(t.username, username),
	});

	if (!user || user.deletedAt || user.status !== "active") {
		return { success: false, message: "用户名或密码错误" };
	}

	const valid = await bcrypt.compare(password, user.passwordHash);
	if (!valid) {
		return { success: false, message: "用户名或密码错误" };
	}

	await db
		.update(adminUser)
		.set({ lastLoginAt: new Date() })
		.where(eq(adminUser.id, user.id));

	const payload: JwtPayload = {
		userId: user.id,
		username: user.username,
		userType: "admin",
	};
	const token = await signToken(payload);

	logger.info({ username: user.username }, "管理员登录成功");
	return {
		success: true,
		user: { id: user.id, username: user.username, email: user.email },
		token,
	};
}

/**
 * 从管理端 JWT token 获取当前登录管理员信息
 * 返回 null 表示未登录或 token 无效
 */
export async function getCurrentAdmin(
	token: string | undefined,
): Promise<AdminUser | null> {
	if (!token) return null;

	const jwtPayload = await verifyToken(token);
	if (!jwtPayload || jwtPayload.userType !== "admin") return null;

	const user = await db.query.adminUser.findFirst({
		where: (t, { eq }) => eq(t.id, jwtPayload.userId),
	});
	if (!user || user.deletedAt || user.status !== "active") return null;

	let roleName: string | undefined;
	if (!user.isRoot) {
		const roleRecord = await db.query.adminRole.findFirst({
			where: (t, { eq: e }) => e(t.id, user.adminRoleId),
		});
		roleName = roleRecord?.name ?? undefined;
	}

	return {
		id: user.id,
		username: user.username,
		email: user.email,
		avatar: user.avatar,
		isRoot: user.isRoot,
		roleName,
		userType: "admin",
	};
}

/**
 * 获取管理员鉴权上下文（登录 + 权限），供鉴权中间件使用
 * 带内存缓存（5 分钟 TTL），isRoot 用户自动拥有全部权限
 */
export async function getAdminUserForAuth(userId: string): Promise<
	| {
			success: true;
			id: string;
			username: string;
			email: string;
			isRoot: boolean;
			rolePermissions: string[];
	  }
	| { success: false; reason: "not_found" | "disabled" }
> {
	const cached = adminUserCache.get(userId);
	if (cached) {
		if (cached.status !== "active") {
			return { success: false, reason: "disabled" };
		}
		if (cached.isRoot) {
			return {
				success: true,
				id: cached.id,
				username: cached.username,
				email: cached.email,
				isRoot: true,
				rolePermissions: ["**"],
			};
		}
		const permissions = await getAdminRolePermissions(cached.adminRoleId);
		return {
			success: true,
			id: cached.id,
			username: cached.username,
			email: cached.email,
			isRoot: false,
			rolePermissions: permissions,
		};
	}

	const user = await db.query.adminUser.findFirst({
		where: (t, { eq: e, isNull: n }) => and(e(t.id, userId), n(t.deletedAt)),
	});
	if (!user) return { success: false, reason: "not_found" };

	const cacheEntry: CachedAdminUser = {
		id: user.id,
		username: user.username,
		email: user.email,
		avatar: user.avatar,
		isRoot: user.isRoot,
		adminRoleId: user.adminRoleId,
		status: user.status,
	};
	adminUserCache.set(userId, cacheEntry);

	if (user.status !== "active") return { success: false, reason: "disabled" };

	let rolePermissions: string[] = [];
	if (user.isRoot) {
		rolePermissions = ["**"];
	} else {
		rolePermissions = await getAdminRolePermissions(user.adminRoleId);
	}

	return {
		success: true,
		id: user.id,
		username: user.username,
		email: user.email,
		isRoot: user.isRoot,
		rolePermissions,
	};
}

/** 使管理员用户缓存失效（更新/删除/重置密码后调用） */
export function clearAdminUserCache(userId: string): void {
	adminUserCache.delete(userId);
}
