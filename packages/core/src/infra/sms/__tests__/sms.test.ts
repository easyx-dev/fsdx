/**
 * 短信发送模块测试：配置读取、服务商分发、发送成功/失败、未初始化 fail-fast
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "../../logger";

const mockGetConfig = vi.fn();
const mockLogger = {
	error: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
	debug: vi.fn(),
	trace: vi.fn(),
	fatal: vi.fn(),
} as unknown as Logger;

vi.mock("@alicloud/openapi-client", () => ({
	Config: vi.fn(),
}));

const { mockSendSms } = vi.hoisted(() => ({
	mockSendSms: vi.fn(),
}));

vi.mock("@alicloud/dysmsapi20170525", () => ({
	__esModule: true,
	default: class {
		sendSms = mockSendSms;
	},
	SendSmsRequest: vi.fn(),
}));

import { initSms, resetSmsForTest, sendSms } from "../index";

describe("sendSms", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetConfig.mockReset();
		resetSmsForTest();
		initSms({ getConfig: mockGetConfig, logger: mockLogger });
	});

	it("未配置短信服务商时抛出异常", async () => {
		mockGetConfig.mockResolvedValue("");

		await expect(sendSms("13800138000", "123456")).rejects.toThrow(
			"短信服务未配置",
		);
	});

	it("不支持的服务商时抛出异常", async () => {
		mockGetConfig.mockResolvedValue("unknown");

		await expect(sendSms("13800138000", "123456")).rejects.toThrow(
			"不支持的短信服务商",
		);
	});

	it("阿里云未配置 AccessKey 时抛出异常", async () => {
		mockGetConfig.mockImplementation((key: string) => {
			if (key === "sms_provider") return "aliyun";
			return "";
		});

		await expect(sendSms("13800138000", "123456")).rejects.toThrow(
			"阿里云短信未配置",
		);
	});

	it("阿里云短信发送成功", async () => {
		mockGetConfig.mockImplementation((key: string) => {
			const map: Record<string, string> = {
				sms_provider: "aliyun",
				sms_aliyun_access_key_id: "test-id",
				sms_aliyun_access_key_secret: "test-secret",
				sms_aliyun_sign_name: "测试签名",
				sms_aliyun_template_code: "SMS_12345",
			};
			return map[key] ?? "";
		});
		mockSendSms.mockResolvedValue({ body: { code: "OK" } });

		await expect(sendSms("13800138000", "123456")).resolves.toBeUndefined();
	});

	it("阿里云短信 API 返回错误码时抛出异常", async () => {
		mockGetConfig.mockImplementation((key: string) => {
			const map: Record<string, string> = {
				sms_provider: "aliyun",
				sms_aliyun_access_key_id: "test-id",
				sms_aliyun_access_key_secret: "test-secret",
				sms_aliyun_sign_name: "测试签名",
				sms_aliyun_template_code: "SMS_12345",
			};
			return map[key] ?? "";
		});
		mockSendSms.mockResolvedValue({
			body: { code: "isv.BUSINESS_LIMIT_CONTROL", message: "触发业务限流" },
		});

		await expect(sendSms("13800138000", "123456")).rejects.toThrow(
			"阿里云短信: 触发业务限流",
		);
	});

	it("短信签名未配置时抛出异常", async () => {
		mockGetConfig.mockImplementation((key: string) => {
			const map: Record<string, string> = {
				sms_provider: "aliyun",
				sms_aliyun_access_key_id: "test-id",
				sms_aliyun_access_key_secret: "test-secret",
				sms_aliyun_sign_name: "",
				sms_aliyun_template_code: "SMS_12345",
			};
			return map[key] ?? "";
		});

		await expect(sendSms("13800138000", "123456")).rejects.toThrow(
			"短信签名未配置",
		);
	});
});

describe("initSms", () => {
	it("未初始化时调用 sendSms 抛错（fail-fast）", async () => {
		resetSmsForTest();
		await expect(sendSms("13800138000", "123456")).rejects.toThrow(
			"请先调用 initSms()",
		);
	});
});
