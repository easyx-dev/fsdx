/**
 * 验证码 Server Function 包装器：图片验证码生成 + 图片校验后发送邮箱验证码
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
	generateImageCaptcha,
	sendCaptcha,
	verifyImageCaptcha,
} from "#/server/captcha/captcha.server";

/** 生成图片验证码（公开接口，无需鉴权） */
export const getImageCaptchaSFn = createServerFn({ method: "GET" }).handler(
	async () => {
		return generateImageCaptcha();
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
		const imageValid = await verifyImageCaptcha(imageToken, imageCode);
		if (!imageValid) {
			return { success: false, message: "图片验证码错误或已过期" };
		}
		return sendCaptcha("email", email);
	});
