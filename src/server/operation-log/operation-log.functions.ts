/**
 * 操作日志 Server Function 包装器
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import {
	getOperationLogModules,
	searchOperationLogs,
} from "./operation-log.server";

const searchOperationLogsSchema = z.object({
	module: z.string().optional(),
	action: z.string().optional(),
	keyword: z.string().optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	page: z.number().optional(),
	pageSize: z.number().optional(),
});

/** JSON 可序列化的递归值类型 */
type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

/** SF 可序列化的操作日志条目 */
export interface OperationLogEntry {
	id: string;
	operatorId: string;
	operatorName: string;
	module: string;
	action: string;
	targetType: string;
	targetId: string | null;
	targetName: string | null;
	detail: JsonValue;
	createdAt: string;
}

/** SF 可序列化的操作日志查询结果 */
export interface OperationLogQueryResult {
	entries: OperationLogEntry[];
	total: number;
	page: number;
	pageSize: number;
}

/** 分页查询操作日志 */
export const searchOperationLogsFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.LOG_VIEW)])
	.inputValidator(searchOperationLogsSchema)
	.handler(async ({ data }) => {
		const result = await searchOperationLogs(data);
		return {
			total: result.total,
			page: result.page,
			pageSize: result.pageSize,
			entries: result.entries.map((e) => ({
				id: e.id,
				operatorId: e.operatorId,
				operatorName: e.operatorName,
				module: e.module,
				action: e.action,
				targetType: e.targetType,
				targetId: e.targetId,
				targetName: e.targetName,
				detail: e.detail as JsonValue,
				createdAt:
					e.createdAt instanceof Date
						? e.createdAt.toISOString()
						: String(e.createdAt),
			})),
		};
	});

/** 获取操作模块列表 */
export const getOperationLogModulesFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.LOG_VIEW)])
	.handler(async () => {
		return getOperationLogModules();
	});
