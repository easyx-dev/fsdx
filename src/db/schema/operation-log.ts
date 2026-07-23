/**
 * 操作日志表：记录管理端用户的所有数据变更操作
 * 采用内存缓冲批量写入，避免高频 DB 调用
 */
import {
	index,
	jsonb,
	pgTable,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

export const operationLog = pgTable(
	"operation_log",
	{
		id: uuid().defaultRandom().primaryKey(),
		operatorId: uuid().notNull(),
		operatorName: varchar({ length: 100 }).notNull(),
		module: varchar({ length: 50 }).notNull(),
		action: varchar({ length: 50 }).notNull(),
		targetType: varchar({ length: 50 }).notNull(),
		targetId: uuid(),
		targetName: varchar({ length: 500 }),
		detail: jsonb().$type<Record<string, unknown>>(),
		createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("idx_operation_log_module").on(table.module),
		index("idx_operation_log_operator").on(table.operatorId),
		index("idx_operation_log_created_at").on(table.createdAt),
	],
);
