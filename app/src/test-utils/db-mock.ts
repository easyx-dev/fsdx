/**
 * Drizzle 数据库 mock 工厂
 * 提供可链式调用的 mock 实例，测试中通过 mockResolvedValue 控制返回值
 */

import { vi } from "vitest";

/**
 * 创建 mock Drizzle 数据库实例
 * 所有查询/变更方法均为 vi.fn()，支持链式调用
 */
export function createMockDb() {
	const _createQueryMock = () => ({
		findFirst: vi.fn(),
		findMany: vi.fn(),
	});

	return {
		query: {
			adminUser: _createQueryMock(),
			captchaCode: _createQueryMock(),
			clientUser: _createQueryMock(),
			dict: _createQueryMock(),
			dictItem: _createQueryMock(),
			file: _createQueryMock(),
			news: _createQueryMock(),
			adminRole: _createQueryMock(),
			systemConfig: _createQueryMock(),
		},
		$count: vi.fn(),
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(),
			})),
		})),
		insert: vi.fn(() => ({
			values: vi.fn(() => ({
				returning: vi.fn(),
			})),
		})),
		update: vi.fn(() => ({
			set: vi.fn(() => ({
				where: vi.fn(),
			})),
		})),
		delete: vi.fn(() => ({
			where: vi.fn(),
		})),
	};
}
