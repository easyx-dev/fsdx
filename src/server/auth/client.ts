/**
 * 客户端用户认证：登录、注册、发送验证码（zod 校验）
 */

import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { clientUser } from "#/db/schema";
import { COOKIE_NAMES, type JwtPayload, signToken } from "#/lib/jwt";
import { logger } from "#/lib/logger";
import {
	sendCaptcha as sendCaptchaUtil,
	verifyCaptcha,
} from "#/server/captcha";

const loginSchema = z.object({
	username: z.string().min(1, "用户名不能为空").max(50),
	password: z.string().min(1, "密码不能为空").max(100),
});

const registerSchema = z.object({
	username: z.string().min(1, "用户名不能为空").max(50),
	email: z.string().email("邮箱格式不正确"),
	password: z.string().min(6, "密码至少 6 位").max(100),
	captcha: z.string().length(6, "验证码为 6 位"),
});

const sendCaptchaSchema = z.object({
	email: z.string().email("邮箱格式不正确"),
});

/** 客户端用户登录 */
export const clientLogin = createServerFn({ method: "POST" })
	.inputValidator(loginSchema)
	.handler(async ({ data: { username, password } }) => {
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

		setCookie(COOKIE_NAMES.ACCESS_TOKEN, token, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
			maxAge: 7 * 24 * 3600, // 7 天
		});

		logger.info({ username: user.username }, "客户端用户登录成功");
		return {
			success: true,
			user: { id: user.id, username: user.username, email: user.email },
		};
	});

/** 客户端用户注册 */
export const clientRegister = createServerFn({ method: "POST" })
	.inputValidator(registerSchema)
	.handler(async ({ data: { username, email, password, captcha } }) => {
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
	});

/** 发送验证码 */
export const sendCaptchaFn = createServerFn({ method: "POST" })
	.inputValidator(sendCaptchaSchema)
	.handler(async ({ data: { email } }) => {
		return sendCaptchaUtil("email", email);
	});
