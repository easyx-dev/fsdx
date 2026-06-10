/**
 * 客户端用户登录、注册与当前用户查询核心逻辑（纯函数）
 */

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "#/db/index";
import { clientUser } from "#/db/schema";
import { type CachedClientUser, clientUserCache } from "#/lib/cache/cache";
import { type JwtPayload, signToken, verifyToken } from "#/lib/jwt/jwt";
import { logger } from "#/lib/logger/logger";
import { verifyCaptcha } from "#/server/captcha/captcha.server";
import type {
	ClientLoginResult,
	ClientRegisterResult,
	ClientUser,
} from "#/server/client-auth/client-auth.types";

/**
 * 客户端用户登录逻辑：验证用户名密码，签发 JWT
 * 调用方（路由 SF）负责设置 Cookie
 */
export async function clientLogin(
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

/**
 * 客户端用户注册逻辑：验证码校验 + 用户名/邮箱唯一性校验
 */
export async function clientRegister(
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

/**
 * 从客户端 JWT token 获取当前登录用户信息
 * 优先从缓存读取，缓存在用户信息变更时需主动清除
 * 返回 null 表示未登录或 token 无效
 */
export async function getCurrentClient(
	token: string | undefined,
): Promise<ClientUser | null> {
	if (!token) return null;

	const jwtPayload = await verifyToken(token);
	if (!jwtPayload || jwtPayload.userType !== "client") return null;

	// 查缓存（缓存中存有 status，读取时校验是否仍为 active）
	const cached = clientUserCache.get(jwtPayload.userId);
	if (cached && cached.status === "active") {
		return {
			id: cached.id,
			username: cached.username,
			email: cached.email,
			avatar: cached.avatar,
			isRoot: false,
			userType: "client" as const,
		};
	}

	const user = await db.query.clientUser.findFirst({
		where: (t, { eq }) => eq(t.id, jwtPayload.userId),
	});
	if (!user || user.deletedAt || user.status !== "active") return null;

	const cacheEntry: CachedClientUser = {
		id: user.id,
		username: user.username,
		email: user.email,
		avatar: user.avatar,
		status: user.status,
	};
	clientUserCache.set(jwtPayload.userId, cacheEntry);

	return {
		id: user.id,
		username: user.username,
		email: user.email,
		avatar: user.avatar,
		isRoot: false,
		userType: "client",
	};
}
