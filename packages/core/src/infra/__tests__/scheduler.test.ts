/**
 * 定时任务调度器测试：注册、停止、防重复、runOnInit 等
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Logger } from "../logger";

const mockLogger = {
	error: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
	debug: vi.fn(),
	trace: vi.fn(),
	fatal: vi.fn(),
} as unknown as Logger;

const { mockCronStop } = vi.hoisted(() => ({
	mockCronStop: vi.fn(),
}));

vi.mock("cron", () => ({
	CronJob: {
		from: vi.fn(() => ({ stop: mockCronStop })),
	},
	CronTime: {
		validateCronExpression: vi.fn((expr: string) => ({
			valid: expr.trim().split(/\s+/).length >= 5 && expr !== "invalid",
			error: expr === "invalid" ? new Error("校验失败") : undefined,
		})),
	},
}));

import { CronJob } from "cron";
import {
	getTaskNames,
	registerTask,
	resetSchedulerLoggerForTest,
	setSchedulerLogger,
	stopAllTasks,
	stopTask,
} from "../scheduler";

describe("registerTask", () => {
	const mockCronFrom = vi.mocked(CronJob.from);

	beforeEach(() => {
		vi.clearAllMocks();
		setSchedulerLogger(mockLogger);
		stopAllTasks();
	});

	afterEach(() => {
		stopAllTasks();
		resetSchedulerLoggerForTest();
	});

	it("注册成功后将任务加入 getTaskNames", () => {
		registerTask({
			name: "test-task",
			cronExpression: "0 * * * *",
			handler: async () => {},
		});
		expect(getTaskNames()).toContain("test-task");
		expect(mockCronFrom).toHaveBeenCalled();
	});

	it("无效 cron 表达式不注册", () => {
		registerTask({
			name: "bad-task",
			cronExpression: "invalid",
			handler: async () => {},
		});
		expect(getTaskNames()).not.toContain("bad-task");
		expect(mockCronFrom).not.toHaveBeenCalled();
	});

	it("重复注册同名任务跳过", () => {
		const handler = vi.fn();
		registerTask({
			name: "dup-task",
			cronExpression: "0 * * * *",
			handler,
		});
		registerTask({
			name: "dup-task",
			cronExpression: "0 * * * *",
			handler,
		});
		expect(mockCronFrom).toHaveBeenCalledTimes(1);
	});

	it("runOnInit 立即执行 handler", () => {
		const handler = vi.fn().mockResolvedValue(undefined);
		registerTask({
			name: "init-task",
			cronExpression: "0 * * * *",
			handler,
			runOnInit: true,
		});
		// runOnInit 传给 CronJob.from，handler 在 CronJob.from 的 options 中
		expect(mockCronFrom).toHaveBeenCalledWith(
			expect.objectContaining({ runOnInit: true, name: "init-task" }),
		);
	});

	it("handler 异常不中断注册", () => {
		const handler = vi.fn().mockRejectedValue(new Error("失败"));
		registerTask({
			name: "error-task",
			cronExpression: "0 * * * *",
			handler,
		});
		expect(getTaskNames()).toContain("error-task");
	});
});

describe("stopTask", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		setSchedulerLogger(mockLogger);
		stopAllTasks();
	});

	afterEach(() => {
		stopAllTasks();
		resetSchedulerLoggerForTest();
	});

	it("停止已注册任务", () => {
		registerTask({
			name: "stop-me",
			cronExpression: "0 * * * *",
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
		setSchedulerLogger(mockLogger);
		stopAllTasks();
	});

	afterEach(() => {
		stopAllTasks();
		resetSchedulerLoggerForTest();
	});

	it("停止所有任务并清空", () => {
		registerTask({
			name: "task-a",
			cronExpression: "0 * * * *",
			handler: async () => {},
		});
		registerTask({
			name: "task-b",
			cronExpression: "0 * * * *",
			handler: async () => {},
		});
		stopAllTasks();
		expect(getTaskNames()).toEqual([]);
	});
});

describe("setSchedulerLogger", () => {
	it("未注入日志实例时 registerTask 抛错（fail-fast）", () => {
		resetSchedulerLoggerForTest();
		expect(() =>
			registerTask({
				name: "no-logger",
				cronExpression: "0 * * * *",
				handler: async () => {},
			}),
		).toThrow("请先调用 setSchedulerLogger()");
	});
});
