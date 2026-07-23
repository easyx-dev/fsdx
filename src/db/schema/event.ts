/**
 * 埋点事件表：存储客户端上报的原始事件数据
 * 使用内存缓冲批量写入，避免高频 DB 调用
 */
import {
	index,
	jsonb,
	pgTable,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

export const event = pgTable(
	"event",
	{
		id: uuid().defaultRandom().primaryKey(),
		time: timestamp({ withTimezone: true }).notNull(),
		userId: uuid("user_id"),
		sessionId: varchar("session_id", { length: 64 }).notNull(),
		event: varchar({ length: 100 }).notNull(),
		properties: jsonb().$type<Record<string, unknown>>().default({}).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("idx_event_time").on(table.time.desc()),
		index("idx_event_event_time").on(table.event, table.time.desc()),
		index("idx_event_user_id").on(table.userId),
		index("idx_event_session_id").on(table.sessionId),
		index("idx_event_created_at").on(table.createdAt),
	],
);
