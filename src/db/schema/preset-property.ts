/**
 * 预设属性定义表：管理端可配置的事件属性字段
 * 使用 key 作为业务主键，isPreset 标记系统预置
 */
import {
	boolean,
	pgTable,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";

export const presetProperty = pgTable("preset_property", {
	key: varchar({ length: 100 }).primaryKey(),
	label: varchar({ length: 100 }).notNull(),
	dataType: varchar("data_type", { length: 20 }).default("string").notNull(),
	description: text("description"),
	isPreset: boolean("is_preset").default(false).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});
