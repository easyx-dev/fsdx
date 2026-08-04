/**
 * 埋点事件类型定义
 */

import type { trackEventMeta, trackPropertyMeta } from "#/db/schema";
import type { PaginatedSortParams } from "#/types/query";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonProperties = Record<string, any>;

/** 追踪事件输入 */
export interface TrackEventInput {
	time: number;
	userId?: string;
	sessionId: string;
	ip?: string;
	name: string;
	properties: JsonProperties;
}

/** 事件查询条件 */
export interface TrackEventQuery extends PaginatedSortParams {
	name?: string;
	userId?: string;
	sessionId?: string;
	keyword?: string;
	startDate?: string;
	endDate?: string;
}

/** 事件查询结果 */
export interface TrackEventQueryResult {
	records: TrackEventRecord[];
	total: number;
	page: number;
	pageSize: number;
}

/** 事件记录 */
export interface TrackEventRecord {
	id: string;
	time: Date;
	userId: string | null;
	sessionId: string;
	ip?: string;
	name: string;
	properties: JsonProperties;
	createdAt: Date;
}

/** 事件分析查询参数 */
export interface TrackAnalyticsQuery {
	startDate: string;
	endDate: string;
	granularity?: "hour" | "day";
}

/** 时间序列数据点 */
export interface TimeSeriesItem {
	date: string;
	count: number;
}

/** 事件分布项 */
export interface TrackEventDistributionItem {
	name: string;
	count: number;
}

/** 页面排行项 */
export interface TopPageItem {
	pageName: string;
	count: number;
}

/** 分析结果 */
export interface TrackAnalyticsResult {
	timeSeries: TimeSeriesItem[];
	eventDistribution: TrackEventDistributionItem[];
	topPages: TopPageItem[];
	uniqueUsers: number;
	totalEvents: number;
}

/** 元事件记录 */
export type TrackEventMetaRecord = typeof trackEventMeta.$inferSelect;

/** 元事件创建/更新参数 */
export interface TrackEventMetaInput {
	label: string;
	category: string;
	description?: string;
}

/** 元属性记录 */
export type TrackPropertyMetaRecord = typeof trackPropertyMeta.$inferSelect;

/** 元属性创建/更新参数 */
export interface TrackPropertyMetaInput {
	label: string;
	dataType?: string;
	description?: string;
}
