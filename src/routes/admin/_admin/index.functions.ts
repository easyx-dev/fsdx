/**
 * 仪表盘 Server Function
 */
import { createServerFn } from "@tanstack/react-start";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "#/db/index";
import { adminUser, clientUser, file, news } from "#/db/schema";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";

export interface DashboardStats {
	newsTotal: number;
	publishedNews: number;
	adminTotal: number;
	clientTotal: number;
	storageTotal: number;
}

/** 获取仪表盘统计数据 */
export async function getStats(): Promise<DashboardStats> {
	const [newsTotal, publishedNews, adminTotal, clientTotal] = await Promise.all(
		[
			db.$count(db.select().from(news).where(isNull(news.deletedAt))),
			db.$count(
				db
					.select()
					.from(news)
					.where(and(eq(news.status, "published"), isNull(news.deletedAt))),
			),
			db.$count(db.select().from(adminUser).where(isNull(adminUser.deletedAt))),
			db.$count(
				db.select().from(clientUser).where(isNull(clientUser.deletedAt)),
			),
		],
	);

	const storageResult = await db
		.select({ total: sql<number>`COALESCE(SUM(${file.size}), 0)` })
		.from(file)
		.where(and(isNull(file.deletedAt), eq(file.status, "permanent")));
	const storageTotal = storageResult[0]?.total ?? 0;

	return { newsTotal, publishedNews, adminTotal, clientTotal, storageTotal };
}

export const getStatsSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.DASHBOARD_VIEW)])
	.handler(async () => {
		return getStats();
	});
