/**
 * 管理员认证：登录核心逻辑（纯函数，供路由 SF 调用）
 */

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "#/db/index";
import { adminUser } from "#/db/schema";
import { type JwtPayload, signToken } from "#/lib/jwt/jwt";
import { logger } from "#/lib/logger/logger";

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
