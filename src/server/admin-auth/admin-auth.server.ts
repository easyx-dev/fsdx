/**
 * 管理员登录与当前管理员查询核心逻辑（纯函数）
 */

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "#/db/index";
import { adminUser } from "#/db/schema";
import { type JwtPayload, signToken, verifyToken } from "#/lib/jwt/jwt";
import { logger } from "#/lib/logger/logger";
import type {
	AdminLoginResult,
	AdminUser,
} from "#/server/admin-auth/admin-auth.types";
import { verifyCaptcha } from "#/server/captcha/captcha.server";

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

/**
 * 通过邮箱验证码重置管理员密码
 */
export async function resetAdminPasswordByEmail(
	email: string,
	captcha: string,
	newPassword: string,
): Promise<{ success: boolean; message: string }> {
	const captchaValid = await verifyCaptcha("email", email, captcha);
	if (!captchaValid) {
		return { success: false, message: "验证码错误或已过期" };
	}

	const user = await db.query.adminUser.findFirst({
		where: (t, { eq }) => eq(t.email, email),
	});

	if (!user || user.deletedAt) {
		return { success: false, message: "该邮箱未注册管理员账号" };
	}

	if (user.status !== "active") {
		return { success: false, message: "该账号已被禁用，请联系超级管理员" };
	}

	const passwordHash = await bcrypt.hash(newPassword, 10);
	await db
		.update(adminUser)
		.set({ passwordHash, updatedAt: new Date() })
		.where(eq(adminUser.id, user.id));

	logger.info({ userId: user.id }, "管理员密码已重置");
	return { success: true, message: "密码重置成功，请使用新密码登录" };
}
