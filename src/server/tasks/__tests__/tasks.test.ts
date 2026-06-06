/**
 * 定时任务注册测试：验证 registerAllTasks 注册正确任务
 */

import { describe, expect, it, vi } from "vitest";

const { mockRegisterTask } = vi.hoisted(() => ({ mockRegisterTask: vi.fn() }));
vi.mock("#/lib/scheduler", () => ({ registerTask: mockRegisterTask }));

vi.mock("#/lib/logger", () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("#/server/file", () => ({
	cleanExpiredFiles: vi.fn().mockResolvedValue(0),
}));

import { registerAllTasks } from "#/server/tasks";

describe("registerAllTasks", () => {
	it("注册两个定时任务", () => {
		registerAllTasks();
		expect(mockRegisterTask).toHaveBeenCalledTimes(2);
	});
	it("第一个任务是清理过期临时文件", () => {
		registerAllTasks();
		const calls = mockRegisterTask.mock.calls;
		const cleanupTask = calls[0][0];
		expect(cleanupTask.name).toBe("清理过期临时文件");
		expect(cleanupTask.cronExpression).toBe("0 * * * *");
	});
	it("第二个任务是清理过期日志文件", () => {
		registerAllTasks();
		const calls = mockRegisterTask.mock.calls;
		const logTask = calls[1][0];
		expect(logTask.name).toBe("清理过期日志文件");
		expect(logTask.cronExpression).toBe("0 3 * * *");
	});
});
