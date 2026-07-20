/**
 * 新闻表：CMS 核心内容
 */
import {
	boolean,
	index,
	integer,
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
		description: text("description"),
		content: text(), // TipTap JSON
		coverImageId: uuid("cover_image_id").references(() => file.id),
		externalUrl: text("external_url"),
		status: varchar({ length: 20 }).default("draft").notNull(), // draft | published | archived
		isPinned: boolean("is_pinned").default(false).notNull(),
		isRecommended: boolean("is_recommended").default(false).notNull(),
		sortOrder: integer("sort_order").default(0).notNull(),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		createdById: uuid("created_by_id").references(() => adminUser.id),
		updatedById: uuid("updated_by_id").references(() => adminUser.id),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => [index("idx_news_created_at").on(table.createdAt)],
);
