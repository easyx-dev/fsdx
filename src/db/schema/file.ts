/**
 * 文件表：记录上传文件元数据，支持秒传和临时/永久状态
 */
import {
	bigint,
	index,
	pgTable,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

export const file = pgTable(
	"file",
	{
		id: uuid().defaultRandom().primaryKey(),
		sha256: varchar({ length: 64 }).notNull(),
		originalName: varchar("original_name", { length: 500 }).notNull(),
		storedName: varchar("stored_name", { length: 500 }).notNull(),
		mimeType: varchar("mime_type", { length: 100 }).notNull(),
		size: bigint({ mode: "number" }).notNull(),
		path: varchar({ length: 1000 }).notNull(),
		status: varchar({ length: 20 }).default("temp").notNull(),
		expiredAt: timestamp("expired_at"),
		createdByType: varchar("created_by_type", { length: 20 }),
		createdById: uuid("created_by_id"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		deletedAt: timestamp("deleted_at"),
	},
	(table) => [index("idx_file_sha256").on(table.sha256)],
);
