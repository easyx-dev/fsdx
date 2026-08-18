/**
 * 仪表盘统计测试：跨模块聚合查询
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => {
	const q = () => ({ findFirst: vi.fn(), findMany: vi.fn() });
	return {
		mockDb: {
			query: {
				news: q(),
				adminUser: q(),
				clientUser: q(),
				adminRole: q(),
				dict: q(),
				dictItem: q(),
				systemConfig: q(),
				file: q(),
				captchaCode: q(),
			},
			$count: vi.fn(),
			select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn() })) })),
			insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) })),
			update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
			delete: vi.fn(() => ({ where: vi.fn() })),
		},
	};
});
vi.mock("#/db", () => ({ db: mockDb }));

import { getStats } from "#/services/dashboard/dashboard.server";

describe("getStats", () => {
	beforeEach(() => vi.clearAllMocks());
	it("正常聚合返回统计值", async () => {
		mockDb.$count
			.mockResolvedValueOnce(100) // newsTotal
			.mockResolvedValueOnce(80) // publishedNews
			.mockResolvedValueOnce(5) // adminTotal
			.mockResolvedValueOnce(200); // clientTotal
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn().mockResolvedValue([{ total: 1024000 }]),
			})),
		});
		const result = await getStats();
		expect(result.newsTotal).toBe(100);
		expect(result.publishedNews).toBe(80);
		expect(result.adminTotal).toBe(5);
		expect(result.clientTotal).toBe(200);
		expect(result.storageTotal).toBe(1024000);
	});
	it("空数据库返回零值", async () => {
		mockDb.$count.mockResolvedValue(0);
		mockDb.$count.mockResolvedValue(0);
		mockDb.$count.mockResolvedValue(0);
		mockDb.$count.mockResolvedValue(0);
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
		});
		const result = await getStats();
		expect(result.storageTotal).toBe(0);
	});
});
