/**
 * 客户端忘记密码服务层：验证码校验 + 密码重置
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "#/db/index";
import { clientUser } from "#/db/schema";
import { logger } from "#/lib/logger/logger";
import { verifyCaptcha } from "#/services/captcha/captcha.server";
import { clearClientUserCache } from "#/services/client-auth/client-auth.server";

/**
 * 重置客户端用户密码（可测试的核心逻辑）
 * 校验验证码后更新密码哈希，并清除用户缓存
 */
export async function resetClientPassword(
	email: string,
	captcha: string,
	password: string,
): Promise<{ success: boolean; message: string }> {
	const captchaValid = await verifyCaptcha("email", email, captcha);
	if (!captchaValid) {
		return { success: false, message: "验证码错误或已过期" };
	}

	const [user] = await db
		.select()
		.from(clientUser)
		.where(eq(clientUser.email, email))
		.limit(1);

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
}
