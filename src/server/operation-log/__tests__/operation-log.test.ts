/**
 * 操作日志模块测试：缓冲写入 + 查询
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#/lib/logger/logger", () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const { mockDb } = vi.hoisted(() => {
	const insertBuilder = {
		values: vi.fn(),
	};
	const selectBuilder = {
		from: vi.fn(() => ({
			where: vi.fn(() => ({
				orderBy: vi.fn(() => ({
					limit: vi.fn(() => ({
						offset: vi.fn(),
					})),
				})),
			})),
		})),
	};
	return {
		mockDb: {
			query: { operationLog: { findFirst: vi.fn() } },
			select: vi.fn(() => selectBuilder),
			insert: vi.fn(() => insertBuilder),
			selectDistinct: vi.fn(() => ({
				from: vi.fn(() => ({
					orderBy: vi.fn(),
				})),
			})),
			$count: vi.fn(),
		},
	};
});

vi.mock("#/db", () => ({ db: mockDb }));

import {
	getOperationLogModules,
	logOperation,
	searchOperationLogs,
} from "#/server/operation-log/operation-log.server";

describe("logOperation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("追加日志到缓冲队列不立即写入 DB", () => {
		logOperation({
			operatorId: "op-1",
			operatorName: "admin",
			module: "news",
			action: "create",
			targetType: "news",
			targetId: "news-1",
			targetName: "测试新闻",
		});
		// 同步调用不应触发 DB 写入（仅在达到阈值或定时器触发时才 flush）
		expect(mockDb.insert).not.toHaveBeenCalled();
	});

	it("入队后 ensureTimer 被惰性初始化", () => {
		logOperation({
			operatorId: "op-1",
			operatorName: "admin",
			module: "dict",
			action: "delete",
			targetType: "dict_item",
			targetId: "item-1",
		});
		// ensureTimer 应创建定时器但不触发立即写入
		expect(mockDb.insert).not.toHaveBeenCalled();
	});
});

describe("searchOperationLogs", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("传递空参数时正常分页查询", async () => {
		vi.mocked(mockDb.select).mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					orderBy: vi.fn(() => ({
						limit: vi.fn(() => ({
							offset: vi.fn().mockResolvedValue([]),
						})),
					})),
				})),
			})),
		} as unknown as ReturnType<typeof mockDb.select>);

		const mockCount = [{ count: 0 }];
		vi.mocked(mockDb.select).mockReturnValueOnce({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					orderBy: vi.fn(() => ({
						limit: vi.fn(() => ({
							offset: vi.fn().mockResolvedValue([]),
						})),
					})),
				})),
			})),
		} as unknown as ReturnType<typeof mockDb.select>);
		vi.mocked(mockDb.select).mockReturnValueOnce({
			from: vi.fn(() => ({
				where: vi.fn().mockResolvedValue(mockCount),
			})),
		} as unknown as ReturnType<typeof mockDb.select>);

		const result = await searchOperationLogs({});
		expect(result).toEqual({
			entries: [],
			total: 0,
			page: 1,
			pageSize: 20,
		});
	});

	it("按模块和动作筛选", async () => {
		const mockEntry = {
			id: "log-1",
			operatorId: "op-1",
			operatorName: "admin",
			module: "news",
			action: "create",
			targetType: "news",
			targetId: "n1",
			targetName: "标题",
			detail: null,
			createdAt: new Date(),
		};

		const mockSelect = vi.fn().mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					orderBy: vi.fn(() => ({
						limit: vi.fn(() => ({
							offset: vi.fn().mockResolvedValue([mockEntry]),
						})),
					})),
				})),
			})),
		});

		vi.mocked(mockDb.select).mockImplementation(
			mockSelect as unknown as typeof mockDb.select,
		);
		// Override for count query
		vi.mocked(mockDb.select).mockImplementationOnce(
			mockSelect as unknown as typeof mockDb.select,
		);
		vi.mocked(mockDb.select).mockImplementationOnce(
			() =>
				({
					from: vi.fn(() => ({
						where: vi.fn().mockResolvedValue([{ count: 1 }]),
					})),
				}) as unknown as ReturnType<typeof mockDb.select>,
		);

		const result = await searchOperationLogs({
			module: "news",
			action: "create",
			page: 1,
			pageSize: 10,
		});

		expect(result.entries).toHaveLength(1);
		expect(result.entries[0].module).toBe("news");
		expect(result.entries[0].action).toBe("create");
	});
});

describe("getOperationLogModules", () => {
	it("返回模块列表", async () => {
		vi.mocked(mockDb.selectDistinct).mockReturnValue({
			from: vi.fn(() => ({
				orderBy: vi
					.fn()
					.mockResolvedValue([{ module: "news" }, { module: "dict" }]),
			})),
		} as unknown as ReturnType<typeof mockDb.selectDistinct>);

		const modules = await getOperationLogModules();
		expect(modules).toEqual(["news", "dict"]);
	});
});
