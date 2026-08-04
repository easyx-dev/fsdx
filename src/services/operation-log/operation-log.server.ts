/**
 * 操作日志服务层：内存缓冲批量写入 + 分页查询
 * logOperation 为 fire-and-forget 调用，5 秒或满 100 条时批量 INSERT
 */
import { and, eq, gte, ilike, lt, or } from "drizzle-orm";
import { db } from "#/db/index";
import { operationLog } from "#/db/schema";
import { logger } from "#/lib/logger/logger";
import {
	buildSortClause,
	executePaginatedQuery,
	paginationOffset,
} from "#/services/query/query-utils.server";
import type { PaginatedSortParams } from "#/types/query";

/** 操作日志输入参数 */
export interface OperationLogInput {
	operatorId: string;
	operatorName: string;
	module: string;
	action: string;
	targetType: string;
	targetId?: string;
	targetName?: string;
	detail?: Record<string, unknown>;
}

/** 操作日志查询参数 */
export interface OperationLogQuery extends PaginatedSortParams {
	module?: string;
	action?: string;
	keyword?: string;
	startDate?: string;
	endDate?: string;
}

/** 操作日志查询结果 */
export interface OperationLogQueryResult {
	records: (typeof operationLog.$inferSelect)[];
	total: number;
	page: number;
	pageSize: number;
}

// ═══════════════════════════════════════════════════
// 内存缓冲
// ═══════════════════════════════════════════════════

const FLUSH_INTERVAL = 5000;
const BATCH_SIZE = 100;
const MAX_BUFFER_SIZE = 1000;

const buffer: OperationLogInput[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let flushing = false;

/** 批量写入数据库 */
async function flushBuffer(source: string): Promise<void> {
	if (buffer.length === 0 || flushing) return;
	flushing = true;

	const batch = [...buffer];
	try {
		await db.insert(operationLog).values(
			batch.map((item) => ({
				operatorId: item.operatorId,
				operatorName: item.operatorName,
				module: item.module,
				action: item.action,
				targetType: item.targetType,
				targetId: item.targetId ?? null,
				targetName: item.targetName ?? null,
				detail: item.detail ?? null,
			})),
		);
		buffer.splice(0, batch.length);
	} catch (err) {
		logger.error(
			{ error: (err as Error).message, count: batch.length },
			`操作日志批量写入失败 (${source})`,
		);
	} finally {
		flushing = false;
	}
}

/** 启动定时刷新（惰性初始化，首次调用 logOperation 时触发） */
function ensureTimer(): void {
	if (flushTimer) return;
	flushTimer = setInterval(() => {
		flushBuffer("timer");
	}, FLUSH_INTERVAL);

	// 确保刷新计时器不会阻止进程退出
	if (flushTimer && typeof flushTimer === "object" && "unref" in flushTimer) {
		flushTimer.unref();
	}
}

/** 追加操作日志到缓冲队列（同步返回，不阻塞业务） */
export function logOperation(params: OperationLogInput): void {
	ensureTimer();
	if (buffer.length >= MAX_BUFFER_SIZE) {
		buffer.shift();
		logger.warn("操作日志缓冲已满，丢弃最旧条目");
	}
	buffer.push(params);
	if (buffer.length >= BATCH_SIZE) {
		flushBuffer("batch");
	}
}

/** 强制刷新缓冲（用于服务关闭前兜底） */
export async function flushOperationLogs(): Promise<void> {
	if (flushTimer) {
		clearInterval(flushTimer);
		flushTimer = null;
	}
	await flushBuffer("shutdown");
}

// ═══════════════════════════════════════════════════
// 查询
// ═══════════════════════════════════════════════════

/** 分页查询操作日志 */
export async function searchOperationLogs(
	query?: OperationLogQuery,
): Promise<OperationLogQueryResult> {
	const {
		module,
		action,
		keyword,
		startDate,
		endDate,
		page = 1,
		pageSize = 20,
		sortField,
		sortOrder,
	} = query ?? {};

	const conditions = [];

	if (module) {
		conditions.push(eq(operationLog.module, module));
	}
	if (action) {
		conditions.push(eq(operationLog.action, action));
	}
	if (keyword) {
		conditions.push(
			or(
				ilike(operationLog.operatorName, `%${keyword}%`),
				ilike(operationLog.targetName, `%${keyword}%`),
				ilike(operationLog.module, `%${keyword}%`),
			)!,
		);
	}
	if (startDate) {
		conditions.push(gte(operationLog.createdAt, new Date(startDate)));
	}
	if (endDate) {
		// endDate 应包含当天全天，设为次日 00:00
		const end = new Date(endDate);
		end.setDate(end.getDate() + 1);
		conditions.push(lt(operationLog.createdAt, end));
	}

	const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

	const offset = paginationOffset(page, pageSize);

	const sortFieldMap = {
		createdAt: operationLog.createdAt,
	};
	const direction = buildSortClause(
		sortFieldMap,
		sortField,
		sortOrder,
		"createdAt",
	);

	return executePaginatedQuery(
		db
			.select()
			.from(operationLog)
			.where(whereCondition)
			.orderBy(direction)
			.limit(pageSize)
			.offset(offset),
		db.$count(db.select().from(operationLog).where(whereCondition)),
		page,
		pageSize,
	);
}

/** 获取已有的操作模块列表（供筛选下拉） */
export async function getOperationLogModules(): Promise<string[]> {
	const rows = await db
		.selectDistinct({ module: operationLog.module })
		.from(operationLog)
		.orderBy(operationLog.module);
	return rows.map((r) => r.module);
}
