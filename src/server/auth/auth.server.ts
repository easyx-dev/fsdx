/**
 * 管理员与客户端用户认证、当前用户查询核心逻辑（纯函数）
 */

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "#/db/index";
import { adminUser, clientUser } from "#/db/schema";
import { type JwtPayload, signToken, verifyToken } from "#/lib/jwt/jwt";
import { logger } from "#/lib/logger/logger";
import { verifyCaptcha } from "#/server/captcha/captcha.server";

export interface AdminLoginResult {
	success: boolean;
	message?: string;
	user?: { id: string; username: string; email: string };
	token?: string;
}

/**
 * 管理员登录逻辑：验证用户名密码，签发 JWT
 * 调用方（路由 SF）负责设置 Cookie
 */
export async function adminLoginService(
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

export interface ClientLoginResult {
	success: boolean;
	message?: string;
	user?: { id: string; username: string; email: string };
	token?: string;
}

/** 客户端用户登录逻辑 */
export async function clientLoginService(
	username: string,
	password: string,
): Promise<ClientLoginResult> {
	const user = await db.query.clientUser.findFirst({
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
		.update(clientUser)
		.set({ lastLoginAt: new Date() })
		.where(eq(clientUser.id, user.id));

	const payload: JwtPayload = {
		userId: user.id,
		username: user.username,
		userType: "client",
	};
	const token = await signToken(payload);

	logger.info({ username: user.username }, "客户端用户登录成功");
	return {
		success: true,
		user: { id: user.id, username: user.username, email: user.email },
		token,
	};
}

export interface ClientRegisterResult {
	success: boolean;
	message: string;
}

/** 客户端用户注册逻辑 */
export async function clientRegisterService(
	username: string,
	email: string,
	password: string,
	captcha: string,
): Promise<ClientRegisterResult> {
	const captchaValid = await verifyCaptcha("email", email, captcha);
	if (!captchaValid) {
		return { success: false, message: "验证码错误或已过期" };
	}

	const existing = await db.query.clientUser.findFirst({
		where: (t, { or }) => or(eq(t.username, username), eq(t.email, email)),
	});

	if (existing) {
		return { success: false, message: "用户名或邮箱已存在" };
	}

	const passwordHash = await bcrypt.hash(password, 10);
	await db.insert(clientUser).values({
		username,
		email,
		passwordHash,
		emailVerified: true,
	});

	logger.info({ username }, "客户端用户注册成功");
	return { success: true, message: "注册成功" };
}

/** 统一用户信息类型 */
export interface AuthUser {
	id: string;
	username: string;
	email: string;
	avatar?: string | null;
	isRoot: boolean;
	roleName?: string;
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
		let roleName: string | undefined;
		if (!user.isRoot) {
			const roleRecord = await db.query.role.findFirst({
				where: (t, { eq }) => eq(t.id, user.roleId),
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

	const user = await db.query.clientUser.findFirst({
		where: (t, { eq }) => eq(t.id, jwtPayload.userId),
	});
	if (!user || user.deletedAt || user.status !== "active") return null;
	return {
		id: user.id,
		username: user.username,
		email: user.email,
		avatar: user.avatar,
		isRoot: false,
		userType: "client",
	};
}
