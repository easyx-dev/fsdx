/**
 * 定时任务调度器测试：注册、停止、防重复、runOnInit 等
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 使用 vi.hoisted 确保变量在 vi.mock 提升之前初始化
const { mockCronStop } = vi.hoisted(() => ({
	mockCronStop: vi.fn(),
}));

vi.mock("node-cron", () => ({
	default: {
		schedule: vi.fn(() => ({ stop: mockCronStop })),
		validate: vi.fn((expr: string) => expr.trim().split(/\s+/).length >= 5),
	},
}));

vi.mock("#/lib/logger/logger", () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import cron from "node-cron";
import {
	getTaskNames,
	registerTask,
	stopAllTasks,
	stopTask,
} from "#/lib/scheduler/scheduler";

describe("registerTask", () => {
	const mockCronSchedule = vi.mocked(cron.schedule);

	beforeEach(() => {
		vi.clearAllMocks();
		stopAllTasks();
	});

	afterEach(() => {
		stopAllTasks();
	});

	it("注册成功后将任务加入 getTaskNames", () => {
		registerTask({
			name: "test-task",
			cronExpression: "0 * * * * *",
			handler: async () => {},
		});
		expect(getTaskNames()).toContain("test-task");
		expect(mockCronSchedule).toHaveBeenCalled();
	});

	it("无效 cron 表达式不注册", () => {
		registerTask({
			name: "bad-task",
			cronExpression: "invalid",
			handler: async () => {},
		});
		expect(getTaskNames()).not.toContain("bad-task");
		expect(mockCronSchedule).not.toHaveBeenCalled();
	});

	it("重复注册同名任务跳过", () => {
		const handler = vi.fn();
		registerTask({
			name: "dup-task",
			cronExpression: "0 * * * * *",
			handler,
		});
		registerTask({
			name: "dup-task",
			cronExpression: "0 * * * * *",
			handler,
		});
		expect(mockCronSchedule).toHaveBeenCalledTimes(1);
	});

	it("runOnInit 立即执行 handler", () => {
		const handler = vi.fn().mockResolvedValue(undefined);
		registerTask({
			name: "init-task",
			cronExpression: "0 * * * * *",
			handler,
			runOnInit: true,
		});
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("handler 异常不中断注册", () => {
		const handler = vi.fn().mockRejectedValue(new Error("失败"));
		registerTask({
			name: "error-task",
			cronExpression: "0 * * * * *",
			handler,
			runOnInit: true,
		});
		expect(getTaskNames()).toContain("error-task");
	});
});

describe("stopTask", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		stopAllTasks();
	});

	afterEach(() => {
		stopAllTasks();
	});

	it("停止已注册任务", () => {
		registerTask({
			name: "stop-me",
			cronExpression: "0 * * * * *",
			handler: async () => {},
		});
		stopTask("stop-me");
		expect(getTaskNames()).not.toContain("stop-me");
		expect(mockCronStop).toHaveBeenCalled();
	});

	it("停止不存在的任务不抛异常", () => {
		expect(() => stopTask("不存在")).not.toThrow();
	});
});

describe("stopAllTasks", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		stopAllTasks();
	});

	afterEach(() => {
		stopAllTasks();
	});

	it("停止所有任务并清空", () => {
		registerTask({
			name: "task-a",
			cronExpression: "0 * * * * *",
			handler: async () => {},
		});
		registerTask({
			name: "task-b",
			cronExpression: "0 * * * * *",
			handler: async () => {},
		});
		stopAllTasks();
		expect(getTaskNames()).toEqual([]);
	});
});
