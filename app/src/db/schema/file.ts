/**
 * 文件表：记录上传文件元数据，支持秒传和临时/永久状态
 */
import {
	bigint,
	index,
	integer,
	pgTable,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { pk, softDelete, timestamps } from "./columns";

export const file = pgTable(
	"file",
	{
		...pk(),
		sha256: varchar({ length: 64 }).notNull(),
		originalName: varchar("original_name", { length: 500 }).notNull(),
		storedName: varchar("stored_name", { length: 500 }).notNull(),
		mimeType: varchar("mime_type", { length: 100 }).notNull(),
		size: bigint({ mode: "number" }).notNull(),
		path: varchar({ length: 1000 }).notNull(),
		/** 图片宽度（非图片或未解析时为 null） */
		width: integer("width"),
		/** 图片高度（非图片或未解析时为 null） */
		height: integer("height"),
		status: varchar({ length: 20 }).default("temp").notNull(),
		expiredAt: timestamp("expired_at", { withTimezone: true }),
		createdByType: varchar("created_by_type", { length: 20 }),
		createdById: uuid("created_by_id"),
		...timestamps(),
		...softDelete(),
	},
	(table) => [index("idx_file_sha256").on(table.sha256)],
);
