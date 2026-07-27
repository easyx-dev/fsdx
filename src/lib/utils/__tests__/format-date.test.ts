/**
 * 日期格式化工具测试：中文/英文格式、日期时间格式
 */
import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "#/lib/utils/format-date";

describe("formatDate", () => {
	it("中文 locale 输出中文格式", () => {
		const result = formatDate("2026-03-15", "zh");
		expect(result).toBe("2026年3月15日");
	});

	it("zh-CN locale 输出中文格式", () => {
		const result = formatDate("2026-03-15", "zh-CN");
		expect(result).toBe("2026年3月15日");
	});

	it("英文 locale 输出英文格式", () => {
		const result = formatDate("2026-03-15", "en");
		expect(result).toBe("March 15, 2026");
	});

	it("en-US locale 输出英文格式", () => {
		const result = formatDate("2026-06-11", "en-US");
		expect(result).toBe("June 11, 2026");
	});

	it("支持 Date 对象输入", () => {
		const result = formatDate(new Date("2026-01-01"), "zh");
		expect(result).toBe("2026年1月1日");
	});

	it("支持时间戳输入", () => {
		const result = formatDate(new Date("2026-12-01").getTime(), "zh");
		expect(result).toBe("2026年12月1日");
	});
});

describe("formatDateTime", () => {
	it("输出 YYYY-MM-DD HH:mm 格式", () => {
		const result = formatDateTime("2026-03-15T14:30:00", "zh");
		expect(result).toBe("2026-03-15 14:30");
	});

	it("英文 locale 同样输出固定格式", () => {
		const result = formatDateTime("2026-03-15T09:05:00", "en");
		expect(result).toBe("2026-03-15 09:05");
	});

	it("支持 Date 对象输入", () => {
		const result = formatDateTime(new Date("2026-06-11T08:00:00"), "zh");
		expect(result).toBe("2026-06-11 08:00");
	});
});
