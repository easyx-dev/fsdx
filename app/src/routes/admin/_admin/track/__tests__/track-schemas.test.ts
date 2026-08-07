/**
 * 埋点事件 Schema 验证测试
 */
import { describe, expect, it } from "vitest";
import { trackEventSchema } from "#/services/track/track.functions";
import { analyticsQuerySchema } from "../-mods/analytics.functions";
import { trackEventQuerySchema } from "../-mods/query.functions";

describe("trackEventSchema", () => {
	it("最小有效参数应通过校验", () => {
		const result = trackEventSchema.safeParse({
			time: 1700000000000,
			sessionId: "abc123",
			name: "PageView",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.properties).toEqual({});
		}
	});

	it("传入 userId 和 properties 应通过校验", () => {
		const result = trackEventSchema.safeParse({
			time: 1700000000000,
			userId: "user-1",
			sessionId: "abc123",
			name: "Click",
			properties: { page: "/home", button: "login" },
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.properties).toEqual({
				page: "/home",
				button: "login",
			});
		}
	});

	it("sessionId 为空字符串应校验失败", () => {
		const result = trackEventSchema.safeParse({
			time: 1700000000000,
			sessionId: "",
			name: "PageView",
		});
		expect(result.success).toBe(false);
	});

	it("event 为空字符串应校验失败", () => {
		const result = trackEventSchema.safeParse({
			time: 1700000000000,
			sessionId: "abc123",
			name: "",
		});
		expect(result.success).toBe(false);
	});

	it("event 超过 100 个字符应校验失败", () => {
		const result = trackEventSchema.safeParse({
			time: 1700000000000,
			sessionId: "abc123",
			name: "a".repeat(101),
		});
		expect(result.success).toBe(false);
	});

	it("不传 properties 应默认为空对象", () => {
		const result = trackEventSchema.safeParse({
			time: 1700000000000,
			sessionId: "abc123",
			name: "PageView",
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.properties).toEqual({});
		}
	});
});

describe("trackEventQuerySchema", () => {
	it("空参数应通过校验", () => {
		const result = trackEventQuerySchema.safeParse({});
		expect(result.success).toBe(true);
	});

	it("所有参数同时传入应通过校验", () => {
		const result = trackEventQuerySchema.safeParse({
			name: "PageView",
			userId: "user-1",
			sessionId: "abc123",
			keyword: "login",
			startDate: "2024-01-01",
			endDate: "2024-12-31",
			page: 1,
			pageSize: 50,
			sortField: "createdAt",
			sortOrder: "ascend",
		});
		expect(result.success).toBe(true);
	});

	it("pageSize 超过 100 应校验失败", () => {
		const result = trackEventQuerySchema.safeParse({ pageSize: 101 });
		expect(result.success).toBe(false);
	});

	it("sortOrder 传入非法值应校验失败", () => {
		const result = trackEventQuerySchema.safeParse({ sortOrder: "invalid" });
		expect(result.success).toBe(false);
	});
});

describe("analyticsQuerySchema", () => {
	it("有效参数应通过校验", () => {
		const result = analyticsQuerySchema.safeParse({
			startDate: "2024-01-01",
			endDate: "2024-12-31",
		});
		expect(result.success).toBe(true);
	});

	it("传入 granularity 应通过校验", () => {
		const result = analyticsQuerySchema.safeParse({
			startDate: "2024-01-01",
			endDate: "2024-12-31",
			granularity: "day",
		});
		expect(result.success).toBe(true);
	});

	it("缺少 startDate 应校验失败", () => {
		const result = analyticsQuerySchema.safeParse({
			endDate: "2024-12-31",
		});
		expect(result.success).toBe(false);
	});

	it("granularity 传入非法值（week）应校验失败", () => {
		const result = analyticsQuerySchema.safeParse({
			startDate: "2024-01-01",
			endDate: "2024-12-31",
			granularity: "week",
		});
		expect(result.success).toBe(false);
	});
});
