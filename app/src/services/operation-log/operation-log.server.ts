/**
 * 操作日志服务层：内存缓冲批量写入 + 分页查询
 * logOperation 为 fire-and-forget 调用，5 秒或满 100 条时批量 INSERT
 * CRUD 审计与外部系统调用日志使用独立缓冲，避免高频 API 日志挤压审计记录
 */

import { BatchWriter } from "@fsdx/core/batch-writer";
import { getRequestOperator } from "@fsdx/core/request-context";
import { and, eq, gte, ilike, lt, or } from "drizzle-orm";
import { db } from "#/db/index";
import { type OperatorType, operationLog } from "#/db/schema";
import { logger } from "#/lib/logger/logger";
import {
	buildSortClause,
	executePaginatedQuery,
	paginationOffset,
} from "#/services/query/query-utils.server";
import type { PaginatedSortParams } from "#/types/query";

/** 操作日志输入参数 */
export interface OperationLogInput {
	operatorId: string | null;
	operatorName: string;
	/** 操作者类型，默认 admin（兼容历史调用） */
	operatorType?: OperatorType;
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

/** 将 OperationLogInput 映射为数据库行 */
function toRow(item: OperationLogInput) {
	return {
		operatorId: item.operatorId,
		operatorName: item.operatorName,
		operatorType: item.operatorType ?? "admin",
		module: item.module,
		action: item.action,
		targetType: item.targetType,
		targetId: item.targetId ?? null,
		targetName: item.targetName ?? null,
		detail: item.detail ?? null,
	};
}

/** CRUD 审计日志缓冲（上限 1000，与外部调用日志隔离，互不挤压） */
const opLogWriter = new BatchWriter<OperationLogInput>({
	logger,
	logLabel: "操作日志",
	insertFn: async (batch) => {
		await db.insert(operationLog).values(batch.map(toRow));
	},
});

/** 追加操作日志到缓冲队列（同步返回，不阻塞业务） */
export function logOperation(params: OperationLogInput): void {
	opLogWriter.push(params);
}

/** CRUD 审计日志的操作用户（结构化入参，避免依赖中间件类型） */
export interface CrudLogOperator {
	id: string;
	username: string;
}

/** CRUD 审计日志目标 */
export interface CrudLogTarget {
	id?: string;
	name?: string | null;
}

/**
 * 写操作审计日志（fire-and-forget）
 * 将 SFn handler 中重复的操作人/模块/targetType 装配收敛为一行调用：
 * logCrud(context.user, "admin-role", "create", { id: result.id, name: result.name })
 */
export function logCrud(
	operator: CrudLogOperator,
	module: string,
	action: string,
	target?: CrudLogTarget,
	options?: {
		targetType?: string;
		detail?: Record<string, unknown>;
		/** 操作者类型，默认 admin；客户端自助操作传 "client" */
		operatorType?: OperatorType;
	},
): void {
	logOperation({
		operatorId: operator.id,
		operatorName: operator.username,
		operatorType: options?.operatorType,
		module,
		action,
		targetType: options?.targetType ?? module,
		targetId: target?.id,
		targetName: target?.name ?? undefined,
		detail: options?.detail,
	});
}

/** 强制刷新缓冲（用于服务关闭前兜底） */
export async function flushOperationLogs(): Promise<void> {
	await Promise.all([opLogWriter.shutdown(), apiLogWriter.shutdown()]);
}

// ═══════════════════════════════════════════════════
// 外部系统调用日志
// ═══════════════════════════════════════════════════

/** 外部系统标识 */
export type ExternalSystem = "ncc" | "oa" | "crm" | "wecom";

/** 外部系统调用日志输入参数 */
export interface ExternalRequestLogInput {
	/** 外部系统标识 */
	system: ExternalSystem;
	/** 请求类型：登录或业务请求 */
	requestType: "login" | "business";
	/** 接口路径 */
	path: string;
	/** HTTP 方法（CRM 有值） */
	method?: string;
	/** 请求耗时（毫秒） */
	duration: number;
	/** 是否成功 */
	success: boolean;
	/** 响应状态码 */
	status?: number;
	/** 响应体大小（字节） */
	responseSize?: number;
	/** 失败时的错误信息 */
	error?: string;
	/** 额外元数据（NCC 的 appcode/busiaction 等），不含请求/响应体 */
	extra?: Record<string, unknown>;
}

/**
 * 外部系统调用日志缓冲（独立于 CRUD 审计，上限 5000，避免高频 API 日志挤压审计记录）
 */
const apiLogWriter = new BatchWriter<OperationLogInput>({
	logger,
	logLabel: "外部调用日志",
	maxBufferSize: 5000,
	insertFn: async (batch) => {
		await db.insert(operationLog).values(batch.map(toRow));
	},
});

/**
 * 记录外部系统调用（NCC / OA / CRM / wecom）到操作日志
 * 操作者从 ALS 读取（鉴权中间件注入），无上下文记 system
 * 响应体内容不入库，仅记录 responseSize
 */
export function logExternalRequest(input: ExternalRequestLogInput): void {
	const op = getRequestOperator();
	const isLogin = input.requestType === "login";
	apiLogWriter.push({
		operatorId: op.id,
		operatorName: op.username ?? op.id ?? "system",
		operatorType: op.type,
		module: "external",
		action: input.success ? "external_success" : "external_fail",
		targetType: input.system,
		targetId: input.path,
		detail: {
			requestType: isLogin ? "login" : "business",
			path: input.path,
			method: input.method ?? null,
			duration: input.duration,
			status: input.status ?? null,
			responseSize: input.responseSize ?? null,
			error: input.error ?? null,
			extra: input.extra ?? null,
		},
	});
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
