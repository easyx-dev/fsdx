/**
 * 通用批量缓冲写入器
 * 提供内存缓冲 → 定时/定量批量写入的通用框架，避免数据丢失和内存泄漏
 * logger 由调用方显式注入，模块自身不依赖全局日志单例
 */
import type { Logger } from "./logger";

export interface BatchWriterConfig<T> {
	/** 日志实例 */
	logger: Logger;
	/** 缓冲上限（超出时丢弃最旧条目），默认 1000 */
	maxBufferSize?: number;
	/** 批量写入阈值（达到此数量触发写入），默认 100 */
	batchSize?: number;
	/** 定时刷新间隔（ms），默认 5000 */
	flushInterval?: number;
	/** 批量写入函数 */
	insertFn: (items: T[]) => Promise<void>;
	/** 日志标签（用于区分不同 writer 的日志） */
	logLabel: string;
}

const DEFAULT_MAX_BUFFER_SIZE = 1000;
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_FLUSH_INTERVAL = 5000;

export class BatchWriter<T> {
	private buffer: T[] = [];
	private timer: ReturnType<typeof setInterval> | null = null;
	private timerStarted = false;
	private flushing = false;
	private readonly logger: Logger;
	private readonly maxBufferSize: number;
	private readonly batchSize: number;
	private readonly flushInterval: number;
	private readonly insertFn: (items: T[]) => Promise<void>;
	private readonly logLabel: string;

	constructor(config: BatchWriterConfig<T>) {
		this.logger = config.logger;
		this.maxBufferSize = config.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE;
		this.batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE;
		this.flushInterval = config.flushInterval ?? DEFAULT_FLUSH_INTERVAL;
		this.insertFn = config.insertFn;
		this.logLabel = config.logLabel;
	}

	/** 追加条目到缓冲队列 */
	push(item: T): void {
		this.ensureTimer();
		if (this.buffer.length >= this.maxBufferSize) {
			this.buffer.shift();
			this.logger.warn(`${this.logLabel} 缓冲已满，丢弃最旧条目`);
		}
		this.buffer.push(item);
		if (this.buffer.length >= this.batchSize) {
			this.flush("batch").catch((err) => {
				this.logger.error({ error: (err as Error).message }, "批量刷新失败");
			});
		}
	}

	/** 批量写入数据库 */
	async flush(source: string): Promise<void> {
		if (this.buffer.length === 0 || this.flushing) return;
		this.flushing = true;

		const batch = [...this.buffer];
		try {
			await this.insertFn(batch);
			this.buffer.splice(0, batch.length);
		} catch (err) {
			this.logger.error(
				{
					error: (err as Error).message,
					cause: (err as Record<string, unknown>)?.cause,
					count: batch.length,
				},
				`${this.logLabel} 批量写入失败 (${source})`,
			);
		} finally {
			this.flushing = false;
		}
	}

	/** 启动定时刷新（惰性初始化，首次 push 时触发） */
	private ensureTimer(): void {
		if (this.timerStarted) return;
		this.timerStarted = true;
		this.timer = setInterval(() => {
			// flush 内部已有 try-catch 兜底，忽略定时器 reject
			this.flush("timer").catch(() => {});
		}, this.flushInterval);

		if (this.timer && typeof this.timer === "object" && "unref" in this.timer) {
			this.timer.unref();
		}
	}

	/** 进程退出前强制刷新 */
	async shutdown(): Promise<void> {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
		await this.flush("shutdown");
	}
}
