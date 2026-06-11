/**
 * 预设事件定义表：管理端可配置的事件类型
 * 使用 name 作为业务主键，isPreset 标记系统预置
 */
import {
	boolean,
	pgTable,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";

export const presetEvent = pgTable("preset_event", {
	name: varchar({ length: 100 }).primaryKey(),
	label: varchar({ length: 100 }).notNull(),
	category: varchar({ length: 50 }).notNull(),
	description: text("description"),
	isPreset: boolean("is_preset").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});
