/**
 * 验证码模块：生成、发送、校验验证码（含图片验证码）
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import { create } from "svg-captcha";
import { db } from "#/db/index";
import { captchaCode } from "#/db/schema";
import { logger } from "#/lib/logger/logger";
import { sendCaptchaMail } from "#/lib/mail/mail";

/** 验证码有效期（5 分钟） */
const CAPTCHA_EXPIRE_MINUTES = 5;
/** 发送频率限制（60 秒） */
const SEND_INTERVAL_SECONDS = 60;
/** 图片验证码有效期（3 分钟） */
const IMAGE_CAPTCHA_EXPIRE_MINUTES = 3;

/** 图片验证码生成配置 */
const CAPTCHA_OPTIONS = {
	size: 4, // 4 位字符
	noise: 3, // 干扰线条数
	color: true, // 彩色字符
	fontSize: 48,
	width: 120,
	height: 42,
	ignoreChars: "0oO1iIlL", // 排除易混淆字符
} as const;

export interface GenerateResult {
	/** 本次验证码的唯一标识 */
	token: string;
	/** SVG 字符串 */
	svg: string;
}

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
		// TODO: SMS 发送预留
		logger.info({ target, code }, "SMS 验证码（待实现）");
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

/**
 * 生成图片验证码
 */
export async function generateImageCaptcha(): Promise<GenerateResult> {
	const { data: svg, text } = create(CAPTCHA_OPTIONS);
	const token = randomUUID();
	const expiredAt = new Date(
		Date.now() + IMAGE_CAPTCHA_EXPIRE_MINUTES * 60 * 1000,
	);

	await db.insert(captchaCode).values({
		type: "image",
		target: token,
		code: text.toLowerCase(),
		expiredAt,
	});

	logger.debug({ token }, "图片验证码已生成");
	return { token, svg };
}

/**
 * 校验图片验证码
 * @returns true 表示校验通过（同时标记为已使用）
 */
export async function verifyImageCaptcha(
	token: string,
	input: string,
): Promise<boolean> {
	const record = await db.query.captchaCode.findFirst({
		where: and(
			eq(captchaCode.type, "image"),
			eq(captchaCode.target, token),
			eq(captchaCode.code, input.toLowerCase().trim()),
			eq(captchaCode.used, false),
			gt(captchaCode.expiredAt, new Date()),
		),
	});

	if (!record) return false;

	// 标记为已使用，防止重复校验
	await db
		.update(captchaCode)
		.set({ used: true })
		.where(eq(captchaCode.id, record.id));

	logger.debug({ token }, "图片验证码校验通过");
	return true;
}
