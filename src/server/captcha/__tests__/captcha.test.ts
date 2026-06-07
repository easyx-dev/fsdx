/**
 * 验证码模块测试：发送 + 校验
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#/lib/logger/logger", () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const { mockSendCaptchaMail } = vi.hoisted(() => ({
	mockSendCaptchaMail: vi.fn(),
}));
vi.mock("#/lib/mail/mail", () => ({ sendCaptchaMail: mockSendCaptchaMail }));

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
				todos: q(),
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

import { sendCaptcha, verifyCaptcha } from "#/server/captcha/captcha.server";

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
