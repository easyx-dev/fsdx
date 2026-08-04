/**
 * 埋点事件服务层：元数据缓存校验 + 属性值类型和安全校验 + 内存缓冲批量写入 + 分页查询 + 聚合分析 + 元事件/元属性管理
 * 数据模型参考神策分析简化版：trackEvent 校验事件名/属性名和值类型后入缓冲，5 秒或满 100 条时批量 INSERT
 */
import { and, eq, gte, ilike, lt, notInArray, or, sql } from "drizzle-orm";
import { db } from "#/db/index";
import {
	trackEventMeta,
	trackEvent as trackEventTable,
	trackPropertyMeta,
} from "#/db/schema";
import { BatchWriter } from "#/lib/buffer/batch-writer";
import { MemoryCache } from "#/lib/cache/core";
import {
	trackEventMetaCache,
	trackPropertyMetaCache,
} from "#/lib/cache/track.cache";
import { logger } from "#/lib/logger/logger";
import {
	buildSortClause,
	executePaginatedQuery,
	paginationOffset,
} from "#/services/query/query-utils.server";
import type { PaginatedSortParams } from "#/types/query";

/** JSON 属性类型：使用 any 而非 unknown 以兼容 TanStack Start 的序列化类型检查 */
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

// ═══════════════════════════════════════════════════
// 元数据缓存
// ═══════════════════════════════════════════════════

let trackMetaCacheLoaded = false;

/** 懒加载元数据缓存 */
async function ensureTrackMetaCache(): Promise<void> {
	if (trackMetaCacheLoaded) return;

	const [eventRows, propertyRows] = await Promise.all([
		db.select({ name: trackEventMeta.name }).from(trackEventMeta),
		db
			.select({
				key: trackPropertyMeta.key,
				dataType: trackPropertyMeta.dataType,
			})
			.from(trackPropertyMeta),
	]);

	trackEventMetaCache.clear();
	trackPropertyMetaCache.clear();

	for (const row of eventRows) {
		trackEventMetaCache.set(row.name, true);
	}
	for (const row of propertyRows) {
		trackPropertyMetaCache.set(row.key, row.dataType);
	}

	trackMetaCacheLoaded = true;
}

/** 使元数据缓存失效，下次访问重新加载 */
function invalidateTrackMetaCache(): void {
	trackMetaCacheLoaded = false;
}

/** 导出缓存加载函数供启动流程预加载 */
export async function loadTrackMetaCache(): Promise<void> {
	await ensureTrackMetaCache();
}

// ═══════════════════════════════════════════════════
// 属性值类型与安全校验
// ═══════════════════════════════════════════════════

const LIMITS = {
	STRING_MAX_LENGTH: 10000,
	ARRAY_MAX_ITEMS: 100,
	OBJECT_MAX_KEYS: 50,
	OBJECT_MAX_DEPTH: 5,
	NUMBER_MAX_SAFE: 1e15,
	NUMBER_MIN_SAFE: -1e15,
} as const;

/** 禁止的对象键（防原型污染） */
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** 校验单个属性值是否符合声明的数据类型和长度限制 */
function isValidPropertyValue(value: unknown, expectedType: string): boolean {
	if (value === null || value === undefined) return true;

	switch (expectedType) {
		case "string":
			if (typeof value !== "string") return false;
			return value.length <= LIMITS.STRING_MAX_LENGTH;

		case "number":
			if (typeof value !== "number") return false;
			return (
				Number.isFinite(value) &&
				value >= LIMITS.NUMBER_MIN_SAFE &&
				value <= LIMITS.NUMBER_MAX_SAFE
			);

		case "boolean":
			return typeof value === "boolean";

		case "date":
			// 接受 ISO 字符串或毫秒时间戳
			if (typeof value === "string") {
				const d = new Date(value);
				return !Number.isNaN(d.getTime());
			}
			if (typeof value === "number") {
				return (
					Number.isFinite(value) &&
					value > 0 &&
					value <= Date.now() + 365 * 24 * 3600 * 1000 // 不超过未来一年
				);
			}
			return false;

		case "array":
			if (!Array.isArray(value)) return false;
			if (value.length > LIMITS.ARRAY_MAX_ITEMS) return false;
			// 逐个元素基础类型校验，防嵌套过深
			for (const item of value) {
				if (
					typeof item !== "string" &&
					typeof item !== "number" &&
					typeof item !== "boolean" &&
					item !== null
				) {
					return false; // 数组元素仅允许基本类型
				}
			}
			return true;

		case "object":
			return isValidPlainObject(value, 0);

		default:
			return false;
	}
}

/** 递归校验纯对象，限制嵌套深度和键数量，防原型污染 */
function isValidPlainObject(value: unknown, depth: number): boolean {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return false;
	}

	if (depth >= LIMITS.OBJECT_MAX_DEPTH) return false;

	const obj = value as Record<string, unknown>;
	const keys = Object.keys(obj);
	if (keys.length > LIMITS.OBJECT_MAX_KEYS) return false;

	for (const key of keys) {
		if (FORBIDDEN_KEYS.has(key)) return false;

		const child = obj[key];
		if (child === null || child === undefined) continue;

		if (typeof child === "object") {
			if (!isValidPlainObject(child, depth + 1)) return false;
		} else if (
			typeof child !== "string" &&
			typeof child !== "number" &&
			typeof child !== "boolean"
		) {
			return false;
		}
	}

	return true;
}

// ═══════════════════════════════════════════════════
// 上报频控（公开接口 per-session 限流）
// ═══════════════════════════════════════════════════

/** 频控阈值：单会话每分钟最多上报条数 */
export const TRACK_RATE_LIMIT = {
	WINDOW_MS: 60_000,
	MAX_PER_SESSION: 60,
} as const;

/** 会话上报计数缓存：key = sessionId，value = 窗口内计数，TTL 滑动过期 */
const sessionRateCache = new MemoryCache<number>({
	name: "track_rate_limit",
});

/** 判断会话是否超过频控阈值；未超限则累加计数 */
function isRateLimited(sessionId: string): boolean {
	const count = sessionRateCache.get(sessionId) ?? 0;
	if (count >= TRACK_RATE_LIMIT.MAX_PER_SESSION) return true;
	sessionRateCache.set(sessionId, count + 1, TRACK_RATE_LIMIT.WINDOW_MS);
	return false;
}

/** 清空频控计数（测试与运维排查用） */
export function clearTrackRateLimit(): void {
	sessionRateCache.clear();
}

// ═══════════════════════════════════════════════════
// 服务端时间钳制（防异常客户端时钟污染时序分析）
// ═══════════════════════════════════════════════════

/** 客户端事件时间允许偏差区间：过去 1 天 ~ 未来 5 分钟 */
const TIME_CLAMP = {
	MIN_AGE_MS: 24 * 3600 * 1000,
	MAX_AHEAD_MS: 5 * 60 * 1000,
} as const;

/** 将客户端上报时间钳制到合理区间，超界则采用服务端时间 */
function clampEventTime(time: number): number {
	const now = Date.now();
	if (
		time >= now - TIME_CLAMP.MIN_AGE_MS &&
		time <= now + TIME_CLAMP.MAX_AHEAD_MS
	) {
		return time;
	}
	return now;
}

// ═══════════════════════════════════════════════════
// 内存缓冲
// ═══════════════════════════════════════════════════

interface TrackEventBufferItem {
	time: Date;
	userId: string | null;
	sessionId: string;
	name: string;
	properties: Record<string, unknown>;
}

/** 埋点事件批量写入器：满 100 条或 5 秒定时刷新，上限 1000 */
const eventWriter = new BatchWriter<TrackEventBufferItem>({
	logLabel: "埋点事件",
	insertFn: async (batch) => {
		await db.insert(trackEventTable).values(
			batch.map((item) => ({
				time: item.time,
				userId: item.userId,
				sessionId: item.sessionId,
				name: item.name,
				properties: item.properties,
			})),
		);
	},
});

/**
 * 追加埋点事件到缓冲队列
 * 依次校验：频控 → 事件名 → 属性键 → 属性值类型 → 安全限制，不合法则记录日志后丢弃
 */
export function trackEvent(input: TrackEventInput): void {
	// 频控：单会话超限直接丢弃
	if (isRateLimited(input.sessionId)) {
		logger.warn(
			{ sessionId: input.sessionId, ip: input.ip },
			"埋点事件被丢弃：会话上报频率超限",
		);
		return;
	}

	// 时间钳制：异常客户端时间以服务端时间为准
	const time = clampEventTime(input.time);
	if (time !== input.time) {
		logger.warn(
			{ originalTime: input.time, sessionId: input.sessionId, ip: input.ip },
			"埋点事件时间超出合理区间，已改用服务端时间",
		);
	}

	// 缓存未就绪时不校验，允许写入（启动阶段兜底）
	if (!trackMetaCacheLoaded) {
		ensureTrackMetaCache().catch((err) => {
			logger.warn({ error: (err as Error).message }, "元数据缓存加载失败");
		});
		pushToBuffer(input, time);
		return;
	}

	// 校验事件名是否在元事件中注册
	if (!trackEventMetaCache.has(input.name)) {
		logger.warn(
			{ name: input.name, sessionId: input.sessionId, ip: input.ip },
			"埋点事件被丢弃：事件名未注册",
		);
		return;
	}

	// 校验属性键和值类型
	for (const key of Object.keys(input.properties)) {
		const value = input.properties[key];

		// $ 开头的系统属性只校验键是否存在，不做类型校验（服务端补齐）
		if (key.startsWith("$")) {
			if (!trackPropertyMetaCache.has(key)) {
				logger.warn(
					{ name: input.name, key, sessionId: input.sessionId, ip: input.ip },
					"埋点事件被丢弃：系统属性键未注册",
				);
				return;
			}
			continue;
		}

		const expectedType = trackPropertyMetaCache.get(key);
		if (!expectedType) {
			logger.warn(
				{ name: input.name, key, sessionId: input.sessionId, ip: input.ip },
				"埋点事件被丢弃：属性键未注册",
			);
			return;
		}

		if (!isValidPropertyValue(value, expectedType)) {
			logger.warn(
				{
					name: input.name,
					key,
					expectedType,
					actualType: typeof value,
					sessionId: input.sessionId,
					ip: input.ip,
				},
				"埋点事件被丢弃：属性值类型校验失败",
			);
			return;
		}
	}

	pushToBuffer(input, time);
}

function pushToBuffer(input: TrackEventInput, time: number): void {
	eventWriter.push({
		time: new Date(time),
		userId: input.userId ?? null,
		sessionId: input.sessionId,
		name: input.name,
		properties: input.properties,
	});
}

/** 强制刷新缓冲（服务关闭前兜底） */
export async function flushTrackEvents(): Promise<void> {
	await eventWriter.shutdown();
}

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

	const conditions = [];

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
			)!,
		);
	}
	if (startDate) {
		conditions.push(gte(trackEventTable.time, new Date(startDate)));
	}
	if (endDate) {
		const end = new Date(endDate);
		end.setDate(end.getDate() + 1);
		conditions.push(lt(trackEventTable.time, end));
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
			properties: e.properties as Record<string, any>,
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
	const start = new Date(startDate);
	const end = new Date(endDate);
	end.setDate(end.getDate() + 1);

	const timeFormat =
		granularity === "hour" ? "YYYY-MM-DD HH24:00" : "YYYY-MM-DD";

	// 时间序列趋势
	const timeSeriesResult = await db.execute(
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

	const timeSeries: TimeSeriesItem[] = (
		(timeSeriesResult as unknown as { rows: { date: string; count: number }[] })
			.rows ?? []
	).map((r) => ({ date: r.date, count: r.count }));

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

// ═══════════════════════════════════════════════════
// 元事件管理
// ═══════════════════════════════════════════════════

/** 获取元事件列表 */
export async function getTrackEventMetaList(): Promise<TrackEventMetaRecord[]> {
	return db
		.select()
		.from(trackEventMeta)
		.orderBy(trackEventMeta.category, trackEventMeta.name);
}

/** 获取单个元事件 */
export async function getTrackEventMeta(
	name: string,
): Promise<TrackEventMetaRecord | null> {
	const rows = await db
		.select()
		.from(trackEventMeta)
		.where(eq(trackEventMeta.name, name))
		.limit(1);
	return rows[0] ?? null;
}

/** 创建元事件 */
export async function createTrackEventMeta(
	name: string,
	input: TrackEventMetaInput,
): Promise<TrackEventMetaRecord> {
	const [row] = await db
		.insert(trackEventMeta)
		.values({
			name,
			label: input.label,
			category: input.category,
			description: input.description ?? null,
		})
		.returning();
	invalidateTrackMetaCache();
	return row;
}

/** 更新元事件 */
export async function updateTrackEventMeta(
	name: string,
	input: Partial<TrackEventMetaInput>,
): Promise<TrackEventMetaRecord | null> {
	const existing = await getTrackEventMeta(name);
	if (!existing) return null;

	const [row] = await db
		.update(trackEventMeta)
		.set({
			...(input.label !== undefined ? { label: input.label } : {}),
			...(input.category !== undefined ? { category: input.category } : {}),
			...(input.description !== undefined
				? { description: input.description }
				: {}),
			updatedAt: new Date(),
		})
		.where(eq(trackEventMeta.name, name))
		.returning();
	invalidateTrackMetaCache();
	return row ?? null;
}

/** 删除元事件（预置事件不可删除） */
export async function deleteTrackEventMeta(name: string): Promise<boolean> {
	const existing = await getTrackEventMeta(name);
	if (!existing || existing.isPreset) return false;

	await db.delete(trackEventMeta).where(eq(trackEventMeta.name, name));
	invalidateTrackMetaCache();
	return true;
}

// ═══════════════════════════════════════════════════
// 元属性管理
// ═══════════════════════════════════════════════════

/** 获取元属性列表 */
export async function getTrackPropertyMetaList(): Promise<
	TrackPropertyMetaRecord[]
> {
	return db.select().from(trackPropertyMeta).orderBy(trackPropertyMeta.key);
}

/** 获取单个元属性 */
export async function getTrackPropertyMeta(
	key: string,
): Promise<TrackPropertyMetaRecord | null> {
	const rows = await db
		.select()
		.from(trackPropertyMeta)
		.where(eq(trackPropertyMeta.key, key))
		.limit(1);
	return rows[0] ?? null;
}

/** 创建元属性 */
export async function createTrackPropertyMeta(
	key: string,
	input: TrackPropertyMetaInput,
): Promise<TrackPropertyMetaRecord> {
	const [row] = await db
		.insert(trackPropertyMeta)
		.values({
			key,
			label: input.label,
			dataType: input.dataType ?? "string",
			description: input.description ?? null,
		})
		.returning();
	invalidateTrackMetaCache();
	return row;
}

/** 更新元属性 */
export async function updateTrackPropertyMeta(
	key: string,
	input: Partial<TrackPropertyMetaInput>,
): Promise<TrackPropertyMetaRecord | null> {
	const existing = await getTrackPropertyMeta(key);
	if (!existing) return null;

	const [row] = await db
		.update(trackPropertyMeta)
		.set({
			...(input.label !== undefined ? { label: input.label } : {}),
			...(input.dataType !== undefined ? { dataType: input.dataType } : {}),
			...(input.description !== undefined
				? { description: input.description }
				: {}),
			updatedAt: new Date(),
		})
		.where(eq(trackPropertyMeta.key, key))
		.returning();
	invalidateTrackMetaCache();
	return row ?? null;
}

/** 删除元属性（预置属性不可删除） */
export async function deleteTrackPropertyMeta(key: string): Promise<boolean> {
	const existing = await getTrackPropertyMeta(key);
	if (!existing || existing.isPreset) return false;

	await db.delete(trackPropertyMeta).where(eq(trackPropertyMeta.key, key));
	invalidateTrackMetaCache();
	return true;
}

// ═══════════════════════════════════════════════════
// 预置数据初始化
// ═══════════════════════════════════════════════════

/** 预置元事件定义 */
const PRESET_EVENTS: {
	name: string;
	label: string;
	category: string;
	description: string;
}[] = [
	{
		name: "PageView",
		label: "页面浏览",
		category: "页面交互",
		description: "用户访问页面时触发",
	},
	{
		name: "FormSubmit",
		label: "表单提交",
		category: "用户行为",
		description: "用户提交表单时触发",
	},
	{
		name: "Login",
		label: "用户登录",
		category: "用户行为",
		description: "用户登录成功时触发",
	},
	{
		name: "Register",
		label: "用户注册",
		category: "用户行为",
		description: "用户完成注册时触发",
	},
	{
		name: "Logout",
		label: "用户退出",
		category: "用户行为",
		description: "用户主动退出登录时触发",
	},
];

/** 预置元属性定义 */
const PRESET_PROPERTIES: {
	key: string;
	label: string;
	dataType: string;
	description: string;
}[] = [
	{
		key: "$ip",
		label: "IP 地址",
		dataType: "string",
		description: "客户端 IP 地址，由服务端提取",
	},
	{
		key: "$user_agent",
		label: "User Agent",
		dataType: "string",
		description: "浏览器 User Agent 字符串",
	},
	{
		key: "$browser",
		label: "浏览器",
		dataType: "string",
		description: "浏览器名称和版本",
	},
	{
		key: "$os",
		label: "操作系统",
		dataType: "string",
		description: "操作系统名称和版本",
	},
	{
		key: "$device_type",
		label: "设备类型",
		dataType: "string",
		description: "设备类型（Desktop / Mobile / Tablet）",
	},
	{
		key: "$screen_size",
		label: "屏幕分辨率",
		dataType: "string",
		description: "用户屏幕分辨率",
	},
	{
		key: "$language",
		label: "浏览器语言",
		dataType: "string",
		description: "浏览器首选语言（navigator.language）",
	},
	{
		key: "page_name",
		label: "页面名称",
		dataType: "string",
		description: "触发事件的页面名称",
	},
	{
		key: "url",
		label: "页面地址",
		dataType: "string",
		description: "触发事件的完整 URL",
	},
	{
		key: "referer",
		label: "来源地址",
		dataType: "string",
		description: "来源页面的 URL",
	},
	{
		key: "form_name",
		label: "表单名称",
		dataType: "string",
		description: "被提交的表单名称（如 clientLogin、clientRegister）",
	},
];

/** 初始化预置元事件（首次启动时插入缺失项，并清理已被裁剪出预置清单的预置事件，完成后刷新缓存） */
export async function ensurePresetEvents(): Promise<void> {
	for (const pe of PRESET_EVENTS) {
		const existing = await getTrackEventMeta(pe.name);
		if (!existing) {
			await db.insert(trackEventMeta).values({
				name: pe.name,
				label: pe.label,
				category: pe.category,
				description: pe.description,
				isPreset: true,
			});
		}
	}
	const presetNames = PRESET_EVENTS.map((e) => e.name);
	await db
		.delete(trackEventMeta)
		.where(
			and(
				eq(trackEventMeta.isPreset, true),
				notInArray(trackEventMeta.name, presetNames),
			),
		);
	invalidateTrackMetaCache();
}

/** 初始化预置元属性（首次启动时插入缺失项，并清理已被裁剪出预置清单的预置属性，完成后刷新缓存） */
export async function ensurePresetProperties(): Promise<void> {
	for (const pp of PRESET_PROPERTIES) {
		const existing = await getTrackPropertyMeta(pp.key);
		if (!existing) {
			await db.insert(trackPropertyMeta).values({
				key: pp.key,
				label: pp.label,
				dataType: pp.dataType,
				description: pp.description,
				isPreset: true,
			});
		}
	}
	const presetKeys = PRESET_PROPERTIES.map((p) => p.key);
	await db
		.delete(trackPropertyMeta)
		.where(
			and(
				eq(trackPropertyMeta.isPreset, true),
				notInArray(trackPropertyMeta.key, presetKeys),
			),
		);
	invalidateTrackMetaCache();
}
