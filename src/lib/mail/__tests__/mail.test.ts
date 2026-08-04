/**
 * 邮件发送模块测试：发送成功/失败、验证码邮件模板
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSendMail = vi.fn();

vi.mock("nodemailer", () => ({
	createTransport: vi.fn(() => ({
		sendMail: mockSendMail,
	})),
}));

vi.mock("#/services/config/config.server", () => ({
	getConfig: vi.fn((key: string) => {
		const map: Record<string, string> = {
			smtp_host: "smtp.test.com",
			smtp_port: "587",
			smtp_secure: "false",
			smtp_user: "test-user",
			smtp_pass: "test-pass",
			smtp_from: "noreply@test.com",
		};
		return map[key] ?? "";
	}),
	loadConfigCache: vi.fn(),
	upsertConfig: vi.fn(),
}));

vi.mock("#/lib/logger/logger", () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { sendCaptchaMail, sendMail } from "#/lib/mail/mail";

describe("sendMail", () => {
	beforeEach(() => {
		mockSendMail.mockClear();
	});

	it("发送成功返回 true", async () => {
		mockSendMail.mockResolvedValueOnce({ messageId: "msg-1" });
		const result = await sendMail({
			to: "user@test.com",
			subject: "测试邮件",
			html: "<p>Hello</p>",
		});
		expect(result).toBe(true);
		expect(mockSendMail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "user@test.com",
				subject: "测试邮件",
				html: "<p>Hello</p>",
			}),
		);
	});

	it("发送失败返回 false（不抛异常）", async () => {
		mockSendMail.mockRejectedValueOnce(new Error("连接失败"));
		const result = await sendMail({
			to: "user@test.com",
			subject: "测试",
			html: "<p>Test</p>",
		});
		expect(result).toBe(false);
	});
});

describe("sendCaptchaMail", () => {
	beforeEach(() => {
		mockSendMail.mockClear();
	});

	it("HTML 模板包含验证码", async () => {
		mockSendMail.mockResolvedValueOnce({ messageId: "msg-2" });
		const result = await sendCaptchaMail("user@test.com", "123456");
		expect(result).toBe(true);
		const callArgs = mockSendMail.mock.calls[0][0];
		expect(callArgs.html).toContain("123456");
		expect(callArgs.subject).toBe("验证码");
	});

	it("委托 sendMail 发送", async () => {
		mockSendMail.mockResolvedValueOnce({ messageId: "msg-3" });
		await sendCaptchaMail("user@test.com", "888888");
		expect(mockSendMail).toHaveBeenCalledTimes(1);
	});
});
