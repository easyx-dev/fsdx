/**
 * 管理员忘记密码 Server Function
 */
import { createServerFn } from "@tanstack/react-start";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { adminUser } from "#/db/schema";
import { logger } from "#/lib/logger/logger";
import { verifyCaptcha } from "#/server/captcha/captcha.server";

export const resetPwdSchema = z
	.object({
		email: z.string().email("请输入有效的邮箱地址"),
		captcha: z.string().length(6, "验证码为 6 位数字"),
		password: z.string().min(6, "密码至少 6 位").max(100),
		confirmPassword: z.string().min(1, "请确认密码"),
	})
	.refine((d) => d.password === d.confirmPassword, {
		message: "两次输入的密码不一致",
		path: ["confirmPassword"],
	});

/** 重置管理员密码（可测试的核心逻辑） */
export async function resetAdminPassword(
	email: string,
	captcha: string,
	password: string,
): Promise<{ success: boolean; message: string }> {
	const captchaValid = await verifyCaptcha("email", email, captcha);
	if (!captchaValid) {
		return { success: false, message: "验证码错误或已过期" };
	}

	const user = await db.query.adminUser.findFirst({
		where: (t, { eq: e }) => e(t.email, email),
	});

	if (!user || user.deletedAt) {
		return { success: false, message: "该邮箱未注册管理员账号" };
	}

	if (user.status !== "active") {
		return { success: false, message: "该账号已被禁用，请联系超级管理员" };
	}

	const passwordHash = await bcrypt.hash(password, 10);
	await db
		.update(adminUser)
		.set({ passwordHash, updatedAt: new Date() })
		.where(eq(adminUser.id, user.id));

	logger.info({ userId: user.id }, "管理员密码已重置");
	return { success: true, message: "密码重置成功，请使用新密码登录" };
}

export const resetPwdSFn = createServerFn({ method: "POST" })
	.inputValidator(resetPwdSchema)
	.handler(async ({ data: { email, captcha, password } }) => {
		return resetAdminPassword(email, captcha, password);
	});
