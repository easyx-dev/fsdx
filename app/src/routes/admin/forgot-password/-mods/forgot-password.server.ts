/**
 * 管理员忘记密码服务层：验证码校验 + 密码重置
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "#/db/index";
import { adminUser } from "#/db/schema";
import { logger } from "#/lib/logger/logger";
import { clearAdminUserCache } from "#/services/admin-auth/admin-auth.server";
import { verifyCaptcha } from "#/services/captcha/captcha.server";

/**
 * 重置管理员密码（可测试的核心逻辑）
 * 校验验证码后更新密码哈希
 */
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

	clearAdminUserCache(user.id);

	logger.info({ userId: user.id }, "管理员密码已重置");
	return { success: true, message: "密码重置成功，请使用新密码登录" };
}
