/**
 * 通用批量缓冲写入器测试：批量写入、定时刷新、容量上限、进程退出兜底
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

import { BatchWriter } from "../batch-writer";

describe("BatchWriter", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("push 单条不立即触发写入", () => {
		const insertFn = vi.fn().mockResolvedValue(undefined);
		const writer = new BatchWriter<number>({
			logger: mockLogger,
			logLabel: "测试",
			insertFn,
		});
		writer.push(1);
		expect(insertFn).not.toHaveBeenCalled();
		writer.shutdown();
	});

	it("达到批量阈值时触发写入并清空缓冲", async () => {
		const insertFn = vi.fn().mockResolvedValue(undefined);
		const writer = new BatchWriter<number>({
			logger: mockLogger,
			logLabel: "测试",
			batchSize: 3,
			insertFn,
		});
		writer.push(1);
		writer.push(2);
		writer.push(3);
		await vi.runOnlyPendingTimersAsync();
		expect(insertFn).toHaveBeenCalledTimes(1);
		expect(insertFn).toHaveBeenCalledWith([1, 2, 3]);
		writer.shutdown();
	});

	it("定时器触发刷新已入队条目", async () => {
		const insertFn = vi.fn().mockResolvedValue(undefined);
		const writer = new BatchWriter<number>({
			logger: mockLogger,
			logLabel: "测试",
			flushInterval: 1000,
			insertFn,
		});
		writer.push(1);
		writer.push(2);
		await vi.advanceTimersByTimeAsync(1000);
		expect(insertFn).toHaveBeenCalledWith([1, 2]);
		writer.shutdown();
	});

	it("缓冲超过上限时丢弃最旧条目", async () => {
		const insertFn = vi.fn().mockResolvedValue(undefined);
		const writer = new BatchWriter<number>({
			logger: mockLogger,
			logLabel: "测试",
			maxBufferSize: 2,
			insertFn,
		});
		writer.push(1);
		writer.push(2);
		writer.push(3);
		await writer.shutdown();
		// 丢弃最旧的 1，写入 [2, 3]
		expect(insertFn).toHaveBeenCalledWith([2, 3]);
	});

	it("写入失败时保留缓冲供下次重试", async () => {
		const insertFn = vi.fn().mockRejectedValue(new Error("db down"));
		const writer = new BatchWriter<number>({
			logger: mockLogger,
			logLabel: "测试",
			batchSize: 2,
			insertFn,
		});
		writer.push(1);
		writer.push(2);
		// push 达阈值触发一次写入失败，缓冲不丢，定时器再触发时仍重试
		await vi.runOnlyPendingTimersAsync();
		expect(insertFn).toHaveBeenCalledTimes(2);
		await writer.shutdown();
		// shutdown 时缓冲仍保留，再次尝试写入
		expect(insertFn).toHaveBeenCalledTimes(3);
	});

	it("shutdown 清理定时器并强制刷新", async () => {
		const insertFn = vi.fn().mockResolvedValue(undefined);
		const writer = new BatchWriter<number>({
			logger: mockLogger,
			logLabel: "测试",
			insertFn,
		});
		writer.push(42);
		await writer.shutdown();
		expect(insertFn).toHaveBeenCalledWith([42]);
		// shutdown 后定时器已清理，再次 push 不触发定时刷新
		writer.push(99);
		await vi.advanceTimersByTimeAsync(6000);
		expect(insertFn).toHaveBeenCalledTimes(1);
	});
});
