/**
 * 当前用户：AuthUser 类型定义 + 获取当前用户核心逻辑
 */

import { db } from "#/db/index";
import { verifyToken } from "#/lib/jwt";

/** 统一用户信息类型 */
export interface AuthUser {
	id: string;
	username: string;
	email: string;
	userType: "admin" | "client";
}

/** JWT Payload 类型（解耦自 jwt 模块） */
interface JwtUserPayload {
	userId: string;
	username: string;
	userType: "admin" | "client";
}

/**
 * 从 JWT token 获取当前登录用户信息
 * 返回 null 表示未登录或 token 无效
 */
export async function getCurrentUser(
	token: string | undefined,
): Promise<AuthUser | null> {
	if (!token) return null;

	const jwtPayload = (await verifyToken(token)) as JwtUserPayload | null;
	if (!jwtPayload) return null;

	if (jwtPayload.userType === "admin") {
		const user = await db.query.adminUser.findFirst({
			where: (t, { eq }) => eq(t.id, jwtPayload.userId),
		});
		if (!user || user.deletedAt || user.status !== "active") return null;
		return {
			id: user.id,
			username: user.username,
			email: user.email,
			userType: "admin",
		};
	}

	const user = await db.query.clientUser.findFirst({
		where: (t, { eq }) => eq(t.id, jwtPayload.userId),
	});
	if (!user || user.deletedAt || user.status !== "active") return null;
	return {
		id: user.id,
		username: user.username,
		email: user.email,
		userType: "client",
	};
}
