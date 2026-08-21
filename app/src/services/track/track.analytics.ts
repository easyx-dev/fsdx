/**
 * 埋点事件查询与分析模块：分页查询、事件名列表、趋势/分布/排行聚合
 */
import { toDayRange } from "@fsdx/core/date-format";
import { and, eq, gte, ilike, lt, or, type SQLWrapper, sql } from "drizzle-orm";
import { db } from "#/db/index";
import { trackEvent as trackEventTable } from "#/db/schema";
import {
	buildSortClause,
	executePaginatedQuery,
	paginationOffset,
} from "#/services/query/query-utils.server";
import type {
	JsonProperties,
	TimeSeriesItem,
	TopPageItem,
	TrackAnalyticsQuery,
	TrackAnalyticsResult,
	TrackEventDistributionItem,
	TrackEventQuery,
	TrackEventQueryResult,
} from "./track.types";

// ═══════════════════════════════════════════════════
// 事件查询
// ═══════════════════════════════════════════════════

/** 分页查询埋点事件 */
export async function searchTrackEvents(
	query: TrackEventQuery,
): Promise<TrackEventQueryResult> {
	const {
		name: eventName,
		userId,
		sessionId,
		keyword,
		startDate,
		endDate,
		page = 1,
		pageSize = 20,
		sortField,
		sortOrder,
	} = query;

	const conditions: (SQLWrapper | undefined)[] = [];

	if (eventName) {
		conditions.push(eq(trackEventTable.name, eventName));
	}
	if (userId) {
		conditions.push(eq(trackEventTable.userId, userId));
	}
	if (sessionId) {
		conditions.push(eq(trackEventTable.sessionId, sessionId));
	}
	if (keyword) {
		conditions.push(
			or(
				ilike(trackEventTable.name, `%${keyword}%`),
				sql`${trackEventTable.properties}::text ILIKE ${`%${keyword}%`}`,
			),
		);
	}
	if (startDate) {
		conditions.push(gte(trackEventTable.time, toDayRange(startDate).start));
	}
	if (endDate) {
		// endDate 按业务时区包含当天全天：排他上界为次日 00:00
		conditions.push(lt(trackEventTable.time, toDayRange(endDate).end));
	}

	const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

	const offset = paginationOffset(page, pageSize);

	const sortFieldMap = { time: trackEventTable.time };
	const direction = buildSortClause(sortFieldMap, sortField, sortOrder, "time");

	const result = await executePaginatedQuery(
		db
			.select()
			.from(trackEventTable)
			.where(whereCondition)
			.orderBy(direction)
			.limit(pageSize)
			.offset(offset),
		db.$count(db.select().from(trackEventTable).where(whereCondition)),
		page,
		pageSize,
	);

	return {
		records: result.records.map((e) => ({
			...e,
			properties: e.properties as JsonProperties,
		})),
		total: result.total,
		page: result.page,
		pageSize: result.pageSize,
	};
}

/** 获取已有的事件名称列表（供筛选下拉） */
export async function getTrackEventNames(): Promise<string[]> {
	const rows = await db
		.selectDistinct({ name: trackEventTable.name })
		.from(trackEventTable)
		.orderBy(trackEventTable.name);
	return rows.map((r) => r.name);
}

// ═══════════════════════════════════════════════════
// 事件分析
// ═══════════════════════════════════════════════════

/** 执行事件分析查询，返回趋势、分布、Top 页面等数据 */
export async function getTrackAnalytics(
	query: TrackAnalyticsQuery,
): Promise<TrackAnalyticsResult> {
	const { startDate, endDate, granularity = "day" } = query;
	// 日期边界按业务统一时区解析，与下方 AT TIME ZONE 'Asia/Shanghai' 分组对齐
	const start = toDayRange(startDate).start;
	const end = toDayRange(endDate).end;

	const timeFormat =
		granularity === "hour" ? "YYYY-MM-DD HH24:00" : "YYYY-MM-DD";

	// 时间序列趋势
	const timeSeriesResult = await db.execute<{ date: string; count: number }>(
		sql`SELECT TO_CHAR(${trackEventTable.time} AT TIME ZONE 'Asia/Shanghai', ${timeFormat}) AS date,
		            COUNT(*)::int AS count
		       FROM ${trackEventTable}
		      WHERE ${trackEventTable.time} >= ${start.toISOString()}
		        AND ${trackEventTable.time} < ${end.toISOString()}
		   GROUP BY date
		   ORDER BY date`,
	);

	// 事件分布
	const distributionResult = await db
		.select({
			name: trackEventTable.name,
			count: sql<number>`count(*)::int`,
		})
		.from(trackEventTable)
		.where(and(gte(trackEventTable.time, start), lt(trackEventTable.time, end)))
		.groupBy(trackEventTable.name)
		.orderBy(sql`count DESC`);

	// Top 页面（PageView 事件中按 page_name 聚合）
	const topPagesResult = await db
		.select({
			pageName: sql<string>`${trackEventTable.properties}->>'page_name'`.as(
				"page_name",
			),
			count: sql<number>`count(*)::int`,
		})
		.from(trackEventTable)
		.where(
			and(
				eq(trackEventTable.name, "PageView"),
				gte(trackEventTable.time, start),
				lt(trackEventTable.time, end),
			),
		)
		.groupBy(sql`${trackEventTable.properties}->>'page_name'`)
		.orderBy(sql`count DESC`)
		.limit(20);

	// 独立用户数
	const uniqueUsersResult = await db
		.select({
			count: sql<number>`count(DISTINCT 
				CASE WHEN ${trackEventTable.userId} IS NOT NULL 
					THEN ${trackEventTable.userId}::text 
					ELSE ${trackEventTable.sessionId} 
				END)::int`,
		})
		.from(trackEventTable)
		.where(
			and(gte(trackEventTable.time, start), lt(trackEventTable.time, end)),
		);

	// 总事件数
	const totalResult = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(trackEventTable)
		.where(
			and(gte(trackEventTable.time, start), lt(trackEventTable.time, end)),
		);

	const timeSeries: TimeSeriesItem[] = (timeSeriesResult.rows ?? []).map(
		(r) => ({ date: r.date, count: r.count }),
	);

	const eventDistribution: TrackEventDistributionItem[] =
		distributionResult.map((r) => ({ name: r.name, count: r.count }));

	const topPages: TopPageItem[] = topPagesResult.map((r) => ({
		pageName: r.pageName ?? "未知页面",
		count: r.count,
	}));

	const uniqueUsers = uniqueUsersResult[0]?.count ?? 0;
	const totalEvents = totalResult[0]?.count ?? 0;

	return {
		timeSeries,
		eventDistribution,
		topPages,
		uniqueUsers,
		totalEvents,
	};
}
