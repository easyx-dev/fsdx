/**
 * 当前用户 Server Function：从 JWT Cookie 获取当前登录用户信息
 */

import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { db } from "#/db/index";
import { COOKIE_NAMES, verifyToken } from "#/lib/jwt";

/** 统一用户信息类型 */
export interface AuthUser {
	id: string;
	username: string;
	email: string;
	userType: "admin" | "client";
}

/**
 * 获取当前登录用户信息
 * 从请求 Cookie 中解析 JWT，查数据库返回完整用户信息
 * 返回 null 表示未登录或 token 无效
 */
export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(
	async (): Promise<AuthUser | null> => {
		const token = getCookie(COOKIE_NAMES.ACCESS_TOKEN);
		if (!token) return null;

		const jwtPayload = await verifyToken(token);
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
	},
);
