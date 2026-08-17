/**
 * 邮件发送模块测试：发送成功/失败、验证码邮件模板、未初始化 fail-fast
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "../../logger";

const mockSendMail = vi.fn();
const mockGetConfig = vi.fn();
const mockLogger = {
	error: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
	debug: vi.fn(),
	trace: vi.fn(),
	fatal: vi.fn(),
} as unknown as Logger;

vi.mock("nodemailer", () => ({
	createTransport: vi.fn(() => ({
		sendMail: mockSendMail,
	})),
}));

import {
	initMail,
	resetMailForTest,
	sendCaptchaMail,
	sendMail,
} from "../index";

describe("sendMail", () => {
	beforeEach(() => {
		mockSendMail.mockClear();
		mockGetConfig.mockReset();
		mockGetConfig.mockImplementation((key: string) => {
			const map: Record<string, string> = {
				smtp_host: "smtp.test.com",
				smtp_port: "587",
				smtp_secure: "false",
				smtp_user: "test-user",
				smtp_pass: "test-pass",
				smtp_from: "noreply@test.com",
			};
			return map[key] ?? "";
		});
		resetMailForTest();
		initMail({ getConfig: mockGetConfig, logger: mockLogger });
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

	it("SMTP 未配置时跳过发送返回 false", async () => {
		mockGetConfig.mockResolvedValue("");
		const result = await sendMail({
			to: "user@test.com",
			subject: "测试",
			html: "<p>Test</p>",
		});
		expect(result).toBe(false);
		expect(mockSendMail).not.toHaveBeenCalled();
	});
});

describe("sendCaptchaMail", () => {
	beforeEach(() => {
		mockSendMail.mockClear();
		mockGetConfig.mockReset();
		mockGetConfig.mockImplementation((key: string) => {
			const map: Record<string, string> = {
				smtp_host: "smtp.test.com",
				smtp_port: "587",
				smtp_secure: "false",
				smtp_user: "test-user",
				smtp_pass: "test-pass",
				smtp_from: "noreply@test.com",
			};
			return map[key] ?? "";
		});
		resetMailForTest();
		initMail({ getConfig: mockGetConfig, logger: mockLogger });
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

describe("initMail", () => {
	it("未初始化时调用 sendMail 抛错（fail-fast）", async () => {
		resetMailForTest();
		await expect(
			sendMail({ to: "a@b.com", subject: "t", html: "<p>1</p>" }),
		).rejects.toThrow("请先调用 initMail()");
	});
});
