/**
 * isCookieSecure() 测试：COOKIE_SECURE 环境变量优先级与生产默认回退
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isCookieSecure } from "../cookie-secure";

// 保存原始环境变量，便于用例间恢复
let originalCookieSecure: string | undefined;
let originalNodeEnv: "development" | "production" | "test" | undefined;

describe("isCookieSecure", () => {
	beforeEach(() => {
		originalCookieSecure = process.env.COOKIE_SECURE;
		originalNodeEnv = process.env.NODE_ENV;
	});

	afterEach(() => {
		if (originalCookieSecure === undefined) {
			delete process.env.COOKIE_SECURE;
		} else {
			process.env.COOKIE_SECURE = originalCookieSecure;
		}
		if (originalNodeEnv === undefined) {
			delete process.env.NODE_ENV;
		} else {
			process.env.NODE_ENV = originalNodeEnv;
		}
	});

	it("COOKIE_SECURE=true 时开启 Secure", () => {
		process.env.COOKIE_SECURE = "true";
		expect(isCookieSecure()).toBe(true);
	});

	it("COOKIE_SECURE=1 时开启 Secure", () => {
		process.env.COOKIE_SECURE = "1";
		expect(isCookieSecure()).toBe(true);
	});

	it("COOKIE_SECURE=false 时关闭 Secure", () => {
		process.env.COOKIE_SECURE = "false";
		expect(isCookieSecure()).toBe(false);
	});

	it("COOKIE_SECURE=0 时关闭 Secure", () => {
		process.env.COOKIE_SECURE = "0";
		expect(isCookieSecure()).toBe(false);
	});

	it("未设置 COOKIE_SECURE 时生产环境默认开启", () => {
		delete process.env.COOKIE_SECURE;
		process.env.NODE_ENV = "production";
		expect(isCookieSecure()).toBe(true);
	});

	it("未设置 COOKIE_SECURE 且非生产环境时关闭", () => {
		delete process.env.COOKIE_SECURE;
		process.env.NODE_ENV = "development";
		expect(isCookieSecure()).toBe(false);
	});
});
