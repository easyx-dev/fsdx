/**
 * 图片验证码模块：生成、校验图片验证码
 * 复用 captcha_code 表，type 使用 "image"
 */
import { randomUUID } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { create } from "svg-captcha";
import { db } from "#/db/index";
import { captchaCode } from "#/db/schema";
import { logger } from "#/lib/logger";

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
