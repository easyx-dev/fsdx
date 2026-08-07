/**
 * 消息模块 Schema 验证测试
 */
import { describe, expect, it } from "vitest";
import {
	adminMessageListSchema,
	messageIdSchema,
	messageListSchema,
	searchRecipientsSchema,
	sendMessageSchema,
} from "../message.schemas";

describe("messageListSchema", () => {
	it("空参数通过校验", () => {
		expect(messageListSchema.safeParse({}).success).toBe(true);
	});

	it("合法 status 通过校验", () => {
		expect(messageListSchema.safeParse({ status: "unread" }).success).toBe(
			true,
		);
	});

	it("非法 status 校验失败", () => {
		expect(messageListSchema.safeParse({ status: "deleted" }).success).toBe(
			false,
		);
	});

	it("pageSize 超过 100 校验失败", () => {
		expect(messageListSchema.safeParse({ pageSize: 101 }).success).toBe(false);
	});
});

describe("messageIdSchema", () => {
	it("合法 id 通过校验", () => {
		expect(messageIdSchema.safeParse({ id: "m-1" }).success).toBe(true);
	});

	it("空 id 校验失败", () => {
		expect(messageIdSchema.safeParse({ id: "" }).success).toBe(false);
	});
});

describe("adminMessageListSchema", () => {
	it("空参数通过校验", () => {
		expect(adminMessageListSchema.safeParse({}).success).toBe(true);
	});

	it("非法 recipientType 校验失败", () => {
		expect(
			adminMessageListSchema.safeParse({ recipientType: "system" }).success,
		).toBe(false);
	});

	it("keyword 超过 100 字符校验失败", () => {
		expect(
			adminMessageListSchema.safeParse({ keyword: "a".repeat(101) }).success,
		).toBe(false);
	});
});

describe("sendMessageSchema", () => {
	const base = {
		recipientType: "client",
		recipientIds: ["a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"],
		title: "通知标题",
	};

	it("合法参数通过校验", () => {
		expect(sendMessageSchema.safeParse(base).success).toBe(true);
	});

	it("recipientIds 非 uuid 校验失败", () => {
		expect(
			sendMessageSchema.safeParse({ ...base, recipientIds: ["abc"] }).success,
		).toBe(false);
	});

	it("recipientIds 为空数组校验失败", () => {
		expect(
			sendMessageSchema.safeParse({ ...base, recipientIds: [] }).success,
		).toBe(false);
	});

	it("title 为空校验失败", () => {
		expect(sendMessageSchema.safeParse({ ...base, title: "" }).success).toBe(
			false,
		);
	});
});

describe("searchRecipientsSchema", () => {
	it("合法参数通过校验", () => {
		expect(
			searchRecipientsSchema.safeParse({ recipientType: "admin" }).success,
		).toBe(true);
	});

	it("缺少 recipientType 校验失败", () => {
		expect(searchRecipientsSchema.safeParse({}).success).toBe(false);
	});
});
