/**
 * 系统配置表：键值对存储
 */
import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const systemConfig = pgTable("system_config", {
	id: uuid().defaultRandom().primaryKey(),
	key: varchar({ length: 100 }).unique().notNull(),
	value: text().notNull(),
	description: text(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
	deletedAt: timestamp("deleted_at"),
});
