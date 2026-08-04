/**
 * 验证码 Server Function 包装器：图片验证码生成 + 图片校验后发送邮箱验证码
 */
import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { and, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { captchaCode } from "#/db/schema";
import { create } from "#/lib/captcha/captcha";
import { logger } from "#/lib/logger/logger";
import { sendCaptcha } from "./captcha.server";

/** 图片验证码生成配置 */
const CAPTCHA_OPTIONS = {
	size: 4,
	noise: 3,
	color: true,
	fontSize: 48,
	width: 120,
	height: 42,
	ignoreChars: "0oO1iIlL",
} as const;

/** 图片验证码有效期（3 分钟） */
const IMAGE_CAPTCHA_EXPIRE_MINUTES = 3;

/** 生成图片验证码（公开接口，无需鉴权） */
export const getImageCaptchaSFn = createServerFn({ method: "GET" }).handler(
	async () => {
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
	},
);

/** 图片验证码校验 + 发送邮箱验证码 */
export const sendCaptchaWithImageVerificationSFn = createServerFn({
	method: "POST",
})
	.inputValidator(
		z.object({
			email: z.string().email("邮箱格式不正确"),
			imageToken: z.string().min(1, "图片验证码标识缺失"),
			imageCode: z.string().min(1, "请输入图片验证码"),
		}),
	)
	.handler(async ({ data: { email, imageToken, imageCode } }) => {
		const record = await db.query.captchaCode.findFirst({
			where: and(
				eq(captchaCode.type, "image"),
				eq(captchaCode.target, imageToken),
				eq(captchaCode.code, imageCode.toLowerCase().trim()),
				eq(captchaCode.used, false),
				gt(captchaCode.expiredAt, new Date()),
			),
		});

		if (!record) {
			return { success: false, message: "图片验证码错误或已过期" };
		}

		await db
			.update(captchaCode)
			.set({ used: true })
			.where(eq(captchaCode.id, record.id));

		logger.debug({ token: imageToken }, "图片验证码校验通过");
		return sendCaptcha("email", email);
	});
