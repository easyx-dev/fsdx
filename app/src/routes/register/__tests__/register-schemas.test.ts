/**
 * 客户端注册 Schema 验证测试
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { registerSchema } from "#/routes/register/register.functions";

const sendCaptchaSchema = z.object({
	email: z.string().email(),
	imageToken: z.string().min(1),
	imageCode: z.string().min(1),
});

describe("registerSchema（客户端注册）", () => {
	it("合法注册输入校验通过", () => {
		expect(
			registerSchema.safeParse({
				username: "user",
				email: "u@t.com",
				password: "123456",
				captcha: "123456",
			}).success,
		).toBe(true);
	});

	it("邮箱格式错误失败", () => {
		expect(
			registerSchema.safeParse({
				username: "user",
				email: "bad",
				password: "123456",
				captcha: "123456",
			}).success,
		).toBe(false);
	});

	it("密码不足 6 位失败", () => {
		expect(
			registerSchema.safeParse({
				username: "user",
				email: "u@t.com",
				password: "12345",
				captcha: "123456",
			}).success,
		).toBe(false);
	});

	it("验证码不是 6 位失败", () => {
		expect(
			registerSchema.safeParse({
				username: "user",
				email: "u@t.com",
				password: "123456",
				captcha: "12345",
			}).success,
		).toBe(false);
	});
});

describe("sendCaptchaSchema（发送验证码）", () => {
	it("合法输入通过", () => {
		expect(
			sendCaptchaSchema.safeParse({
				email: "u@t.com",
				imageToken: "token-123",
				imageCode: "ABCD",
			}).success,
		).toBe(true);
	});

	it("非法邮箱失败", () => {
		expect(
			sendCaptchaSchema.safeParse({
				email: "not-email",
				imageToken: "token-123",
				imageCode: "ABCD",
			}).success,
		).toBe(false);
	});

	it("缺少 imageToken 失败", () => {
		expect(
			sendCaptchaSchema.safeParse({
				email: "u@t.com",
				imageCode: "ABCD",
			}).success,
		).toBe(false);
	});

	it("缺少 imageCode 失败", () => {
		expect(
			sendCaptchaSchema.safeParse({
				email: "u@t.com",
				imageToken: "token-123",
			}).success,
		).toBe(false);
	});
});
