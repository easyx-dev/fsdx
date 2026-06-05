/**
 * 新闻表：CMS 核心内容
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
import { adminUser } from "./admin-user";
import { file } from "./file";

export const news = pgTable(
	"news",
	{
		id: uuid().defaultRandom().primaryKey(),
		title: varchar({ length: 500 }).notNull(),
		slug: varchar({ length: 500 }).unique().notNull(),
		summary: text(),
		content: text(), // TipTap JSON
		coverImageId: uuid("cover_image_id").references(() => file.id),
		status: varchar({ length: 20 }).default("draft").notNull(), // draft | published | archived
		isPinned: boolean("is_pinned").default(false).notNull(),
		publishedAt: timestamp("published_at"),
		createdBy: uuid("created_by").references(() => adminUser.id),
		updatedBy: uuid("updated_by").references(() => adminUser.id),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
		deletedAt: timestamp("deleted_at"),
	},
	(table) => [index("idx_news_created_at").on(table.createdAt)],
);
