/**
 * 客户端忘记密码 Server Functions
 */
import { createServerFn } from "@tanstack/react-start";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { clientUser } from "#/db/schema";
import { logger } from "#/lib/logger/logger";
import { verifyCaptcha } from "#/server/captcha/captcha.server";
import { clearClientUserCache } from "#/server/client-auth/client-auth.server";

export const forgotPasswordSchema = z
	.object({
		email: z.string().email("邮箱格式不正确"),
		captcha: z.string().length(6, "验证码为 6 位"),
		password: z.string().min(6, "密码至少 6 位").max(100),
		confirmPassword: z.string().min(1, "请确认密码"),
	})
	.refine((d) => d.password === d.confirmPassword, {
		message: "两次输入的密码不一致",
		path: ["confirmPassword"],
	});

export const resetPwdSFn = createServerFn({ method: "POST" })
	.inputValidator(forgotPasswordSchema)
	.handler(async ({ data: { email, captcha, password } }) => {
		const captchaValid = await verifyCaptcha("email", email, captcha);
		if (!captchaValid) {
			return { success: false, message: "验证码错误或已过期" };
		}

		const user = await db.query.clientUser.findFirst({
			where: (t, { eq: e }) => e(t.email, email),
		});

		if (!user || user.deletedAt) {
			return { success: false, message: "该邮箱未注册" };
		}

		if (user.status !== "active") {
			return { success: false, message: "该账号已被禁用" };
		}

		const passwordHash = await bcrypt.hash(password, 10);
		await db
			.update(clientUser)
			.set({ passwordHash, updatedAt: new Date() })
			.where(eq(clientUser.id, user.id));

		clearClientUserCache(user.id);

		logger.info({ userId: user.id }, "客户端用户密码已重置");
		return { success: true, message: "密码重置成功" };
	});
