/**
 * 验证码模块测试：发送 + 校验
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#/lib/logger/logger", () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

const { mockSendCaptchaMail } = vi.hoisted(() => ({
	mockSendCaptchaMail: vi.fn(),
}));
vi.mock("@fsdx/core/mail", () => ({ sendCaptchaMail: mockSendCaptchaMail }));

const { mockSendSms } = vi.hoisted(() => ({
	mockSendSms: vi.fn(),
}));
vi.mock("@fsdx/core/sms", () => ({ sendSms: mockSendSms }));

const { mockCreateCaptcha } = vi.hoisted(() => ({
	mockCreateCaptcha: vi.fn(),
}));
vi.mock("@fsdx/core/captcha", () => ({ create: mockCreateCaptcha }));

const { mockDb } = vi.hoisted(() => {
	const q = () => ({ findFirst: vi.fn(), findMany: vi.fn() });
	return {
		mockDb: {
			query: {
				captchaCode: q(),
				adminUser: q(),
				clientUser: q(),
				role: q(),
				news: q(),
				dict: q(),
				dictItem: q(),
				systemConfig: q(),
				file: q(),
			},
			$count: vi.fn(),
			select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn() })) })),
			insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) })),
			update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
			delete: vi.fn(() => ({ where: vi.fn() })),
		},
	};
});
vi.mock("#/db", () => ({ db: mockDb }));

import {
	createImageCaptcha,
	sendCaptcha,
	verifyCaptcha,
	verifyImageCaptcha,
} from "#/services/captcha/captcha.server";

describe("sendCaptcha", () => {
	beforeEach(() => vi.clearAllMocks());

	it("首次发送成功", async () => {
		mockDb.query.captchaCode.findFirst.mockResolvedValue(undefined);
		mockSendCaptchaMail.mockResolvedValue(true);

		const result = await sendCaptcha("email", "user@test.com");
		expect(result.success).toBe(true);
		expect(result.message).toBe("验证码已发送");
		expect(mockDb.insert).toHaveBeenCalled();
	});

	it("60 秒内重复发送被拦截", async () => {
		mockDb.query.captchaCode.findFirst.mockResolvedValue({ id: "recent" });

		const result = await sendCaptcha("email", "user@test.com");
		expect(result.success).toBe(false);
		expect(result.message).toBe("发送过于频繁，请稍后再试");
	});

	it("邮件发送失败返回 false", async () => {
		mockDb.query.captchaCode.findFirst.mockResolvedValue(undefined);
		mockSendCaptchaMail.mockResolvedValue(false);

		const result = await sendCaptcha("email", "user@test.com");
		expect(result.success).toBe(false);
		expect(result.message).toBe("邮件发送失败");
	});
});

describe("verifyCaptcha", () => {
	beforeEach(() => vi.clearAllMocks());

	it("正确验证码返回 true 并标记已使用", async () => {
		mockDb.query.captchaCode.findFirst.mockResolvedValue({ id: "cap-1" });

		const result = await verifyCaptcha("email", "u@t.com", "123456");
		expect(result).toBe(true);
		expect(mockDb.update).toHaveBeenCalled();
	});

	it("错误验证码返回 false", async () => {
		mockDb.query.captchaCode.findFirst.mockResolvedValue(undefined);

		const result = await verifyCaptcha("email", "u@t.com", "wrong");
		expect(result).toBe(false);
	});

	it("不存在的验证码返回 false", async () => {
		mockDb.query.captchaCode.findFirst.mockResolvedValue(undefined);

		const result = await verifyCaptcha("email", "u@t.com", "000000");
		expect(result).toBe(false);
	});
});

describe("sendCaptcha（短信路径）", () => {
	beforeEach(() => vi.clearAllMocks());

	it("短信发送成功返回成功", async () => {
		mockDb.query.captchaCode.findFirst.mockResolvedValue(undefined);
		mockSendSms.mockResolvedValue(undefined);

		const result = await sendCaptcha("sms", "13800138000");

		expect(result.success).toBe(true);
		expect(mockSendSms).toHaveBeenCalledTimes(1);
		expect(mockDb.insert).toHaveBeenCalled();
	});

	it("短信发送抛错时返回失败并带出错误信息", async () => {
		mockDb.query.captchaCode.findFirst.mockResolvedValue(undefined);
		mockSendSms.mockRejectedValue(new Error("短信通道异常"));

		const result = await sendCaptcha("sms", "13800138000");

		expect(result.success).toBe(false);
		expect(result.message).toBe("短信通道异常");
	});
});

describe("createImageCaptcha", () => {
	beforeEach(() => vi.clearAllMocks());

	it("生成 SVG 并落库，验证码转小写", async () => {
		mockCreateCaptcha.mockReturnValue({ data: "<svg>...</svg>", text: "AbCd" });
		const valuesMock = vi.fn();
		mockDb.insert.mockReturnValue({ values: valuesMock });

		const result = await createImageCaptcha();

		expect(result.svg).toBe("<svg>...</svg>");
		expect(result.token).toBeTruthy();
		const values = valuesMock.mock.calls[0][0] as Record<string, unknown>;
		expect(values).toMatchObject({
			type: "image",
			code: "abcd",
		});
		expect(values.expiredAt).toBeInstanceOf(Date);
	});
});

describe("verifyImageCaptcha", () => {
	beforeEach(() => vi.clearAllMocks());

	it("校验通过时返回 true 并标记已使用", async () => {
		mockDb.query.captchaCode.findFirst.mockResolvedValue({ id: "img-1" });

		const result = await verifyImageCaptcha("token-1", "aBcD");

		expect(result).toBe(true);
		expect(mockDb.update).toHaveBeenCalled();
	});

	it("大小写与空格归一后仍可校验通过", async () => {
		mockDb.query.captchaCode.findFirst.mockResolvedValue({ id: "img-1" });

		const result = await verifyImageCaptcha("token-1", "  ABCD  ");

		expect(result).toBe(true);
		expect(mockDb.query.captchaCode.findFirst).toHaveBeenCalledTimes(1);
	});

	it("验证码不存在时返回 false", async () => {
		mockDb.query.captchaCode.findFirst.mockResolvedValue(undefined);

		const result = await verifyImageCaptcha("token-1", "XXXX");

		expect(result).toBe(false);
	});
});
