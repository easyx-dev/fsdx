/**
 * 短信发送模块测试：配置读取、服务商分发、发送成功/失败（getConfig / logger 直接 mock）
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetConfig, mockLogger, mockSendSms } = vi.hoisted(() => ({
	mockGetConfig: vi.fn(),
	mockLogger: {
		error: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
		trace: vi.fn(),
		fatal: vi.fn(),
	},
	mockSendSms: vi.fn(),
}));

vi.mock("#/shared-services/config/config.server", () => ({
	getConfig: mockGetConfig,
}));
vi.mock("#/shared-services/logger", () => ({ logger: mockLogger }));

vi.mock("@alicloud/openapi-client", () => ({
	Config: vi.fn(),
}));

vi.mock("@alicloud/dysmsapi20170525", () => ({
	__esModule: true,
	default: class {
		sendSms = mockSendSms;
	},
	SendSmsRequest: vi.fn(),
}));

import { sendSms } from "../index";

describe("sendSms", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetConfig.mockReset();
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
