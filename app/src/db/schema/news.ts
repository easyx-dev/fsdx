/**
 * 新闻表：业务示例模块核心内容
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
import { pk, publishable, softDelete, sortable, timestamps } from "./columns";
import { file } from "./file";

export const news = pgTable(
	"news",
	{
		...pk(),
		title: varchar({ length: 500 }).notNull(),
		slug: varchar({ length: 500 }).unique().notNull(),
		description: text("description"),
		content: text(), // TipTap JSON
		coverImageId: uuid("cover_image_id").references(() => file.id),
		externalUrl: text("external_url"),
		...publishable(),
		// 发布时间属业务字段，首次发布时由业务侧写入，与上架/下架状态语义分离
		publishedAt: timestamp("published_at", { withTimezone: true }),
		isPinned: boolean("is_pinned").default(false).notNull(),
		isRecommended: boolean("is_recommended").default(false).notNull(),
		...sortable(),
		createdById: uuid("created_by_id").references(() => adminUser.id),
		updatedById: uuid("updated_by_id").references(() => adminUser.id),
		...timestamps(),
		...softDelete(),
	},
	(table) => [index("idx_news_created_at").on(table.createdAt)],
);
