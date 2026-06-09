/**
 * 系统配置表：键值对存储
 */
import {
	boolean,
	index,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

export const systemConfig = pgTable(
	"system_config",
	{
		id: uuid().defaultRandom().primaryKey(),
		key: varchar({ length: 100 }).unique().notNull(),
		value: text().notNull(),
		clientVisible: boolean("client_visible").default(false).notNull(),
		valueType: varchar("value_type", { length: 20 }),
		groupName: varchar("group_name", { length: 50 }),
		description: text(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		deletedAt: timestamp("deleted_at"),
	},
	(table) => [index("idx_system_config_group").on(table.groupName)],
);
