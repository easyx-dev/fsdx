/**
 * 管理员认证：登录 Server Function（zod 校验 + 自动设置 Cookie）
 */

import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { adminUser } from "#/db/schema";
import { COOKIE_NAMES, type JwtPayload, signTokenPair } from "#/lib/jwt";
import { logger } from "#/lib/logger";

const loginSchema = z.object({
	username: z.string().min(1, "用户名不能为空").max(50),
	password: z.string().min(1, "密码不能为空").max(100),
});

export const adminLogin = createServerFn({ method: "POST" })
	.inputValidator(loginSchema)
	.handler(async ({ data: { username, password } }) => {
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
		const tokens = await signTokenPair(payload);

		setCookie(COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
			maxAge: 3600,
		});
		setCookie(COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
			maxAge: 604800,
		});

		logger.info({ username: user.username }, "管理员登录成功");
		return {
			success: true,
			user: { id: user.id, username: user.username, email: user.email },
		};
	});
