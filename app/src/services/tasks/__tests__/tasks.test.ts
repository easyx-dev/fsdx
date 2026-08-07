/**
 * 定时任务注册测试：验证注册配置正确且 handler 逻辑真实执行
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRegisterTask } = vi.hoisted(() => ({ mockRegisterTask: vi.fn() }));
vi.mock("@fsdx/core/scheduler", () => ({
	registerTask: mockRegisterTask,
}));

const { mockCleanExpiredFiles, mockCleanExpiredLogs } = vi.hoisted(() => ({
	mockCleanExpiredFiles: vi.fn(),
	mockCleanExpiredLogs: vi.fn(),
}));

vi.mock("#/services/file/file.server", () => ({
	cleanExpiredFiles: mockCleanExpiredFiles,
}));

vi.mock("#/services/logs/logs-cleanup.server", () => ({
	cleanExpiredLogs: mockCleanExpiredLogs,
}));

const { mockLoggerInfo } = vi.hoisted(() => ({ mockLoggerInfo: vi.fn() }));
vi.mock("#/lib/logger/logger", () => ({
	logger: { error: vi.fn(), info: mockLoggerInfo, warn: vi.fn() },
}));

import { registerAllTasks } from "#/services/tasks/tasks.server";

describe("registerAllTasks", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("注册两个清理定时任务且配置正确", () => {
		registerAllTasks();
		expect(mockRegisterTask).toHaveBeenCalledTimes(2);
		const calls = mockRegisterTask.mock.calls;
		expect(calls[0][0].name).toBe("清理过期临时文件");
		expect(calls[0][0].cronExpression).toBe("0 * * * *");
		expect(calls[1][0].name).toBe("清理过期日志文件");
		expect(calls[1][0].cronExpression).toBe("0 3 * * *");
	});

	it("清理到过期文件时记录清理日志", async () => {
		mockCleanExpiredFiles.mockResolvedValue(3);
		mockCleanExpiredLogs.mockResolvedValue(0);
		registerAllTasks();
		await mockRegisterTask.mock.calls[0][0].handler();
		expect(mockCleanExpiredFiles).toHaveBeenCalledTimes(1);
		expect(mockLoggerInfo).toHaveBeenCalledWith(
			{ count: 3 },
			"已清理过期临时文件",
		);
	});

	it("没有过期文件时不记录清理日志", async () => {
		mockCleanExpiredFiles.mockResolvedValue(0);
		registerAllTasks();
		await mockRegisterTask.mock.calls[0][0].handler();
		expect(mockCleanExpiredFiles).toHaveBeenCalledTimes(1);
		expect(mockLoggerInfo).not.toHaveBeenCalled();
	});

	it("过期日志清理任务 handler 正常执行", async () => {
		mockCleanExpiredFiles.mockResolvedValue(0);
		mockCleanExpiredLogs.mockResolvedValue(2);
		registerAllTasks();
		await mockRegisterTask.mock.calls[1][0].handler();
		expect(mockCleanExpiredLogs).toHaveBeenCalledTimes(1);
		expect(mockLoggerInfo).toHaveBeenCalledWith(
			{ count: 2 },
			"已清理过期日志文件",
		);
	});
});
