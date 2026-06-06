/**
 * 客户端用户认证：登录、注册核心逻辑（纯函数，供路由 SF 调用）
 */

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "#/db/index";
import { clientUser } from "#/db/schema";
import { type JwtPayload, signToken } from "#/lib/jwt";
import { logger } from "#/lib/logger";
import { verifyCaptcha } from "#/server/captcha";

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
