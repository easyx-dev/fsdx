/**
 * 客户端埋点 SDK 测试：会话管理、事件上报、路由追踪
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockTrackEventFn } = vi.hoisted(() => ({
	mockTrackEventFn: vi.fn().mockResolvedValue({ success: true }),
}));

// mock Server Function
vi.mock("#/server/event/event.functions", () => ({
	trackEventFn: mockTrackEventFn,
}));

import {
	getSessionId,
	init,
	setUserId,
	startRouteTracking,
	stopRouteTracking,
	track,
} from "../track";

describe("track SDK", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// 重置模块内部状态：先停止路由追踪，再重新导入
		stopRouteTracking();
	});

	describe("init", () => {
		it("SSR 环境下不执行任何操作", () => {
			// 模拟 window 不存在
			const origWindow = globalThis.window;
			// @ts-expect-error 模拟 SSR
			delete globalThis.window;

			init();

			// 恢复
			globalThis.window = origWindow;

			expect(mockTrackEventFn).not.toHaveBeenCalled();
		});
	});

	describe("setUserId", () => {
		it("设置用户 ID 不报错", () => {
			expect(() => setUserId("user-1")).not.toThrow();
			expect(() => setUserId(undefined)).not.toThrow();
		});
	});

	describe("getSessionId", () => {
		it("返回字符串", () => {
			const sessionId = getSessionId();
			expect(typeof sessionId).toBe("string");
		});
	});

	describe("track", () => {
		it("SSR 环境下不执行上报", async () => {
			const origWindow = globalThis.window;
			const origDocument = globalThis.document;
			// @ts-expect-error 模拟 SSR
			delete globalThis.window;
			// @ts-expect-error 模拟 SSR
			delete globalThis.document;

			await track("Click", { button: "submit" });

			globalThis.window = origWindow;
			globalThis.document = origDocument;

			expect(mockTrackEventFn).not.toHaveBeenCalled();
		});
	});

	describe("startRouteTracking / stopRouteTracking", () => {
		it("SSR 环境下不执行任何操作", () => {
			const origWindow = globalThis.window;
			// @ts-expect-error 模拟 SSR
			delete globalThis.window;

			startRouteTracking();
			stopRouteTracking();

			globalThis.window = origWindow;

			// 不报错即为通过
			expect(true).toBe(true);
		});

		it("浏览器环境下启动路由追踪不报错", () => {
			stopRouteTracking();

			expect(() => startRouteTracking()).not.toThrow();
			// 重复注册不报错（幂等性）
			expect(() => startRouteTracking()).not.toThrow();

			stopRouteTracking();
		});

		it("stopRouteTracking 安全调用（未启动时）", () => {
			stopRouteTracking();
			expect(() => stopRouteTracking()).not.toThrow();
		});
	});
});
