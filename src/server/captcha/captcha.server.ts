/**
 * 验证码模块：生成、发送、校验验证码
 */
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "#/db/index";
import { captchaCode } from "#/db/schema";
import { logger } from "#/lib/logger/logger";
import { sendCaptchaMail } from "#/lib/mail/mail";
import { sendSms } from "#/lib/sms/sms";

/** 验证码有效期（5 分钟） */
const CAPTCHA_EXPIRE_MINUTES = 5;
/** 发送频率限制（60 秒） */
const SEND_INTERVAL_SECONDS = 60;

/**
 * 生成 6 位随机数字验证码
 */
function generateCode(): string {
	return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * 发送验证码
 */
export async function sendCaptcha(
	type: "email" | "sms",
	target: string,
): Promise<{ success: boolean; message: string }> {
	// 检查发送频率
	const recentCode = await db.query.captchaCode.findFirst({
		where: and(
			eq(captchaCode.type, type),
			eq(captchaCode.target, target),
			gt(
				captchaCode.createdAt,
				new Date(Date.now() - SEND_INTERVAL_SECONDS * 1000),
			),
		),
	});

	if (recentCode) {
		return { success: false, message: "发送过于频繁，请稍后再试" };
	}

	// 生成验证码
	const code = generateCode();
	const expiredAt = new Date(Date.now() + CAPTCHA_EXPIRE_MINUTES * 60 * 1000);

	// 存入数据库
	await db.insert(captchaCode).values({
		type,
		target,
		code,
		expiredAt,
	});

	// 发送验证码
	if (type === "email") {
		const sent = await sendCaptchaMail(target, code);
		if (!sent) {
			return { success: false, message: "邮件发送失败" };
		}
	} else {
		try {
			await sendSms(target, code);
		} catch (err) {
			const message = err instanceof Error ? err.message : "短信发送失败";
			logger.warn({ target, error: message }, "短信发送失败");
			return { success: false, message };
		}
	}

	logger.info({ type, target }, "验证码发送成功");
	return { success: true, message: "验证码已发送" };
}

/**
 * 校验验证码
 */
export async function verifyCaptcha(
	type: "email" | "sms",
	target: string,
	code: string,
): Promise<boolean> {
	const record = await db.query.captchaCode.findFirst({
		where: and(
			eq(captchaCode.type, type),
			eq(captchaCode.target, target),
			eq(captchaCode.code, code),
			eq(captchaCode.used, false),
			gt(captchaCode.expiredAt, new Date()),
		),
		orderBy: desc(captchaCode.createdAt),
	});

	if (!record) return false;

	// 标记为已使用
	await db
		.update(captchaCode)
		.set({ used: true })
		.where(eq(captchaCode.id, record.id));

	return true;
}
