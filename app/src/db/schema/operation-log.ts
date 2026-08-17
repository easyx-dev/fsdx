/**
 * 操作日志表：记录用户的数据变更操作与外部系统调用审计
 * 采用内存缓冲批量写入，避免高频 DB 调用
 */

import type { OperatorType } from "@fsdx/core/request-context";
import {
	index,
	jsonb,
	pgTable,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

export type { OperatorType } from "@fsdx/core/request-context";

export const operationLog = pgTable(
	"operation_log",
	{
		id: uuid().defaultRandom().primaryKey(),
		/** 请求关联 ID（requestId），贯穿日志与审计表，实现全链路追踪 */
		requestId: varchar("request_id", { length: 100 }),
		/** 操作者 ID（system 类型时为 null；客户端用户 ID 不属于 admin_user 表，故无外键） */
		operatorId: uuid(),
		operatorName: varchar({ length: 100 }).notNull(),
		/** 操作者类型，默认 admin 兼容历史数据 */
		operatorType: varchar({ length: 20 })
			.$type<OperatorType>()
			.notNull()
			.default("admin"),
		module: varchar({ length: 50 }).notNull(),
		action: varchar({ length: 50 }).notNull(),
		targetType: varchar({ length: 50 }).notNull(),
		targetId: varchar({ length: 500 }),
		targetName: varchar({ length: 500 }),
		detail: jsonb().$type<Record<string, unknown> | null>(),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_operation_log_module").on(table.module),
		index("idx_operation_log_operator").on(table.operatorId),
		index("idx_operation_log_created_at").on(table.createdAt),
	],
);
