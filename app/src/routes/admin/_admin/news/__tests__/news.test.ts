/**
 * 新闻 slug 生成与唯一性校验测试
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockRows } = vi.hoisted(() => {
	const rows = vi.fn().mockResolvedValue([]);
	const chain: any = {
		from: vi.fn(() => chain),
		where: vi.fn(() => chain),
		orderBy: vi.fn(() => chain),
		limit: vi.fn(() => chain),
		offset: vi.fn(() => chain),
		innerJoin: vi.fn(() => chain),
	};
	Object.defineProperty(chain, "then", {
		value: (onFulfilled: (value: unknown) => unknown) =>
			rows().then(onFulfilled),
	});
	return {
		mockDb: {
			select: vi.fn(() => chain),
		},
		mockRows: rows,
	};
});

vi.mock("#/db/index", () => ({ db: mockDb }));

import { generateSlug } from "#/services/news/news.server";
import { ensureUniqueSlug } from "../-mods/news.server";

describe("generateSlug", () => {
	it("英文标题生成 slug", () => {
		const result = generateSlug("Hello World");
		expect(result).toBe("hello-world");
	});

	it("带特殊字符的标题过滤特殊字符", () => {
		const result = generateSlug("Hello, World!");
		expect(result).toBe("hello-world");
	});

	it("中文标题用时间戳", () => {
		const result = generateSlug("你好世界");
		expect(result).toMatch(/^news-\d{13}$/);
	});

	it("空字符串也生成 fallback", () => {
		const result = generateSlug("");
		expect(result).toMatch(/^news-\d{13}$/);
	});

	it("slug 截断到 100 字符", () => {
		const longTitle = `${"a".repeat(120)} world`;
		const result = generateSlug(longTitle);
		expect(result.length).toBeLessThanOrEqual(100);
	});

	it("首尾横线被清除", () => {
		const result = generateSlug("-Hello-");
		expect(result).toBe("hello");
	});
});

describe("ensureUniqueSlug", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("slug 唯一时直接返回", async () => {
		mockRows.mockResolvedValue([]);

		const result = await ensureUniqueSlug("my-slug");

		expect(result).toBe("my-slug");
	});

	it("slug 冲突时追加后缀", async () => {
		mockRows
			.mockReset()
			.mockResolvedValueOnce([{ id: "n-1" }])
			.mockResolvedValueOnce([]);

		const result = await ensureUniqueSlug("my-slug");

		expect(result).toBe("my-slug-1");
		expect(mockDb.select).toHaveBeenCalledTimes(2);
	});

	it("排除自身 id 时判断唯一", async () => {
		mockRows.mockReset().mockResolvedValue([]);

		const result = await ensureUniqueSlug("my-slug", "n-1");

		expect(result).toBe("my-slug");
	});

	it("超过 100 次冲突抛出错误", async () => {
		mockRows.mockReset().mockResolvedValue([{ id: "n-1" }]);

		await expect(ensureUniqueSlug("my-slug")).rejects.toThrow(
			'无法为 slug "my-slug" 生成唯一标识',
		);
	});
});
