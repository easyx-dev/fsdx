/**
 * 埋点事件类型定义
 */

import type { presetEvent, presetProperty } from "#/db/schema";
import type { PaginatedSortParams } from "#/types/query";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonProperties = Record<string, any>;

/** 追踪事件输入 */
export interface TrackEventInput {
	time: number;
	userId?: string;
	sessionId: string;
	ip?: string;
	event: string;
	properties: JsonProperties;
}

/** 事件查询条件 */
export interface EventQuery extends PaginatedSortParams {
	event?: string;
	userId?: string;
	sessionId?: string;
	keyword?: string;
	startDate?: string;
	endDate?: string;
}

/** 事件查询结果 */
export interface EventQueryResult {
	records: EventRecord[];
	total: number;
	page: number;
	pageSize: number;
}

/** 事件记录 */
export interface EventRecord {
	id: string;
	time: Date;
	userId: string | null;
	sessionId: string;
	ip?: string;
	event: string;
	properties: JsonProperties;
	createdAt: Date;
}

/** 事件分析查询参数 */
export interface AnalyticsQuery {
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
export interface EventDistributionItem {
	event: string;
	count: number;
}

/** 页面排行项 */
export interface TopPageItem {
	pageName: string;
	count: number;
}

/** 分析结果 */
export interface AnalyticsResult {
	timeSeries: TimeSeriesItem[];
	eventDistribution: EventDistributionItem[];
	topPages: TopPageItem[];
	uniqueUsers: number;
	totalEvents: number;
}

/** 预设事件记录 */
export type PresetEventRecord = typeof presetEvent.$inferSelect;

/** 预设事件创建/更新参数 */
export interface PresetEventInput {
	label: string;
	category: string;
	description?: string;
}

/** 预设属性记录 */
export type PresetPropertyRecord = typeof presetProperty.$inferSelect;

/** 预设属性创建/更新参数 */
export interface PresetPropertyInput {
	label: string;
	dataType?: string;
	description?: string;
}
