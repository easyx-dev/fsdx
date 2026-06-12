/**
 * 角色表
 */
import {
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

export const role = pgTable("role", {
	id: uuid().defaultRandom().primaryKey(),
	name: varchar({ length: 50 }).unique().notNull(),
	slug: varchar({ length: 50 }).unique().notNull(),
	permissions: jsonb().$type<string[]>().default([]).notNull(),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	deletedAt: timestamp("deleted_at", { withTimezone: true }),
});
