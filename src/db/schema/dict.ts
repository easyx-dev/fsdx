/**
 * 字典表：字典类型定义
 */
import {
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

/** 字典类型 */
export const dict = pgTable("dict", {
	id: uuid().defaultRandom().primaryKey(),
	name: varchar({ length: 100 }).notNull(),
	slug: varchar({ length: 50 }).unique().notNull(),
	description: text(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
	deletedAt: timestamp("deleted_at"),
});

/** 字典条目 */
export const dictItem = pgTable(
	"dict_item",
	{
		id: uuid().defaultRandom().primaryKey(),
		dictSlug: varchar("dict_slug", { length: 50 })
			.references(() => dict.slug, { onUpdate: "cascade" })
			.notNull(),
		label: varchar({ length: 100 }).notNull(),
		value: varchar({ length: 100 }).notNull(),
		sortOrder: integer("sort_order").default(0).notNull(),
		status: varchar({ length: 20 }).default("active").notNull(),
		extraType: varchar("extra_type", { length: 20 }),
		extra: text("extra"),
		color: varchar("color", { length: 20 }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		deletedAt: timestamp("deleted_at"),
	},
	(table) => [
		uniqueIndex("uq_dict_item_dict_slug_value").on(table.dictSlug, table.value),
	],
);
