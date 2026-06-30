/**
 * 埋点事件服务层：预设缓存校验 + 属性值类型和安全校验 + 内存缓冲批量写入 + 分页查询 + 聚合分析 + 预设管理
 * trackEvent 校验事件/属性名和值类型后入缓冲，5 秒或满 100 条时批量 INSERT
 */
import { and, eq, gte, ilike, lt, or, sql } from "drizzle-orm";
import { db } from "#/db/index";
import { event, presetEvent, presetProperty } from "#/db/schema";
import { presetEventCache, presetPropertyCache } from "#/lib/cache/cache";
import { logger } from "#/lib/logger/logger";
import {
	buildSortClause,
	executePaginatedQuery,
	paginationOffset,
} from "#/server/query/query-utils.server";
import type {
	AnalyticsQuery,
	AnalyticsResult,
	EventDistributionItem,
	EventQuery,
	EventQueryResult,
	PresetEventInput,
	PresetEventRecord,
	PresetPropertyInput,
	PresetPropertyRecord,
	TimeSeriesItem,
	TopPageItem,
	TrackEventInput,
} from "./event.types";

// ═══════════════════════════════════════════════════
// 预设缓存（基于 cache 模块的 MemoryCache）
// ═══════════════════════════════════════════════════

let presetCacheLoaded = false;

/** 懒加载预设缓存 */
async function ensurePresetCache(): Promise<void> {
	if (presetCacheLoaded) return;

	const [eventRows, propertyRows] = await Promise.all([
		db.select({ name: presetEvent.name }).from(presetEvent),
		db
			.select({ key: presetProperty.key, dataType: presetProperty.dataType })
			.from(presetProperty),
	]);

	presetEventCache.clear();
	presetPropertyCache.clear();

	for (const row of eventRows) {
		presetEventCache.set(row.name, true);
	}
	for (const row of propertyRows) {
		presetPropertyCache.set(row.key, row.dataType);
	}

	presetCacheLoaded = true;
}

/** 使预设缓存失效，下次访问重新加载 */
function invalidatePresetCache(): void {
	presetCacheLoaded = false;
}

/** 导出缓存加载函数供启动流程预加载 */
export async function loadPresetCache(): Promise<void> {
	await ensurePresetCache();
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

	const keys = Object.keys(value as Record<string, unknown>);
	if (keys.length > LIMITS.OBJECT_MAX_KEYS) return false;

	for (const key of keys) {
		if (FORBIDDEN_KEYS.has(key)) return false;

		const child = (value as Record<string, unknown>)[key];
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
// 内存缓冲
// ═══════════════════════════════════════════════════

const FLUSH_INTERVAL = 5000;
const BATCH_SIZE = 100;
const MAX_BUFFER_SIZE = 1000;

interface EventBufferItem {
	time: Date;
	userId: string | null;
	sessionId: string;
	event: string;
	properties: Record<string, unknown>;
}

const eventBuffer: EventBufferItem[] = [];
let eventFlushTimer: ReturnType<typeof setInterval> | null = null;
let eventFlushing = false;

/** 批量写入数据库 */
async function flushEventBuffer(source: string): Promise<void> {
	if (eventBuffer.length === 0 || eventFlushing) return;
	eventFlushing = true;

	const batch = [...eventBuffer];
	try {
		await db.insert(event).values(
			batch.map((item) => ({
				time: item.time,
				userId: item.userId,
				sessionId: item.sessionId,
				event: item.event,
				properties: item.properties,
			})),
		);
		eventBuffer.splice(0, batch.length);
	} catch (err) {
		logger.error(
			{ error: (err as Error).message, count: batch.length },
			`埋点事件批量写入失败 (${source})`,
		);
	} finally {
		eventFlushing = false;
	}
}

/** 启动定时刷新（惰性初始化） */
function ensureEventFlushTimer(): void {
	if (eventFlushTimer) return;
	eventFlushTimer = setInterval(() => {
		flushEventBuffer("timer");
	}, FLUSH_INTERVAL);

	if (
		eventFlushTimer &&
		typeof eventFlushTimer === "object" &&
		"unref" in eventFlushTimer
	) {
		eventFlushTimer.unref();
	}
}

/**
 * 追加埋点事件到缓冲队列
 * 依次校验：事件名 → 属性键 → 属性值类型 → 安全限制，不合法则记录日志后丢弃
 */
export function trackEvent(input: TrackEventInput): void {
	// 缓存未就绪时不校验，允许写入（启动阶段兜底）
	if (!presetCacheLoaded) {
		ensurePresetCache().catch((err) => {
			logger.warn({ error: (err as Error).message }, "预设缓存加载失败");
		});
		pushToBuffer(input);
		return;
	}

	// 校验事件名是否在预设中
	if (!presetEventCache.has(input.event)) {
		logger.warn(
			{ event: input.event, sessionId: input.sessionId, ip: input.ip },
			"埋点事件被丢弃：事件名不在预设中",
		);
		return;
	}

	// 校验属性键和值类型
	for (const key of Object.keys(input.properties)) {
		const value = input.properties[key];

		// $ 开头的系统属性只校验键是否存在，不做类型校验（服务端补齐）
		if (key.startsWith("$")) {
			if (!presetPropertyCache.has(key)) {
				logger.warn(
					{ event: input.event, key, sessionId: input.sessionId, ip: input.ip },
					"埋点事件被丢弃：系统属性键不在预设中",
				);
				return;
			}
			continue;
		}

		const expectedType = presetPropertyCache.get(key);
		if (!expectedType) {
			logger.warn(
				{ event: input.event, key, sessionId: input.sessionId, ip: input.ip },
				"埋点事件被丢弃：属性键不在预设中",
			);
			return;
		}

		if (!isValidPropertyValue(value, expectedType)) {
			logger.warn(
				{
					event: input.event,
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

	pushToBuffer(input);
}

function pushToBuffer(input: TrackEventInput): void {
	ensureEventFlushTimer();
	if (eventBuffer.length >= MAX_BUFFER_SIZE) {
		eventBuffer.shift();
		logger.warn("埋点事件缓冲已满，丢弃最旧条目");
	}
	eventBuffer.push({
		time: new Date(input.time),
		userId: input.userId ?? null,
		sessionId: input.sessionId,
		event: input.event,
		properties: input.properties,
	});
	if (eventBuffer.length >= BATCH_SIZE) {
		flushEventBuffer("batch");
	}
}

/** 强制刷新缓冲（服务关闭前兜底） */
export async function flushTrackEvents(): Promise<void> {
	if (eventFlushTimer) {
		clearInterval(eventFlushTimer);
		eventFlushTimer = null;
	}
	await flushEventBuffer("shutdown");
}

// ═══════════════════════════════════════════════════
// 事件查询
// ═══════════════════════════════════════════════════

/** 分页查询埋点事件 */
export async function searchEvents(
	query: EventQuery,
): Promise<EventQueryResult> {
	const {
		event: eventName,
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
		conditions.push(eq(event.event, eventName));
	}
	if (userId) {
		conditions.push(eq(event.userId, userId));
	}
	if (sessionId) {
		conditions.push(eq(event.sessionId, sessionId));
	}
	if (keyword) {
		conditions.push(
			or(
				ilike(event.event, `%${keyword}%`),
				sql`${event.properties}::text ILIKE ${`%${keyword}%`}`,
			)!,
		);
	}
	if (startDate) {
		conditions.push(gte(event.time, new Date(startDate)));
	}
	if (endDate) {
		const end = new Date(endDate);
		end.setDate(end.getDate() + 1);
		conditions.push(lt(event.time, end));
	}

	const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

	const offset = paginationOffset(page, pageSize);

	const sortFieldMap = { time: event.time };
	const direction = buildSortClause(sortFieldMap, sortField, sortOrder, "time");

	const result = await executePaginatedQuery(
		db
			.select()
			.from(event)
			.where(whereCondition)
			.orderBy(direction)
			.limit(pageSize)
			.offset(offset),
		db.$count(db.select().from(event).where(whereCondition)),
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
export async function getEventNames(): Promise<string[]> {
	const rows = await db
		.selectDistinct({ event: event.event })
		.from(event)
		.orderBy(event.event);
	return rows.map((r) => r.event);
}

// ═══════════════════════════════════════════════════
// 事件分析
// ═══════════════════════════════════════════════════

/** 执行事件分析查询，返回趋势、分布、Top 页面等数据 */
export async function getEventAnalytics(
	query: AnalyticsQuery,
): Promise<AnalyticsResult> {
	const { startDate, endDate, granularity = "day" } = query;
	const start = new Date(startDate);
	const end = new Date(endDate);
	end.setDate(end.getDate() + 1);

	const timeFormat =
		granularity === "hour" ? "YYYY-MM-DD HH24:00" : "YYYY-MM-DD";

	// 时间序列趋势
	const timeSeriesResult = await db.execute(
		sql`SELECT TO_CHAR(${event.time} AT TIME ZONE 'Asia/Shanghai', ${timeFormat}) AS date,
		            COUNT(*)::int AS count
		       FROM ${event}
		      WHERE ${event.time} >= ${start.toISOString()}
		        AND ${event.time} < ${end.toISOString()}
		   GROUP BY date
		   ORDER BY date`,
	);

	// 事件分布
	const distributionResult = await db
		.select({
			event: event.event,
			count: sql<number>`count(*)::int`,
		})
		.from(event)
		.where(and(gte(event.time, start), lt(event.time, end)))
		.groupBy(event.event)
		.orderBy(sql`count DESC`);

	// Top 页面（PageView 事件中按 page_name 聚合）
	const topPagesResult = await db
		.select({
			pageName: sql<string>`${event.properties}->>'page_name'`.as("page_name"),
			count: sql<number>`count(*)::int`,
		})
		.from(event)
		.where(
			and(
				eq(event.event, "PageView"),
				gte(event.time, start),
				lt(event.time, end),
			),
		)
		.groupBy(sql`${event.properties}->>'page_name'`)
		.orderBy(sql`count DESC`)
		.limit(20);

	// 独立用户数
	const uniqueUsersResult = await db
		.select({
			count: sql<number>`count(DISTINCT 
				CASE WHEN ${event.userId} IS NOT NULL 
					THEN ${event.userId}::text 
					ELSE ${event.sessionId} 
				END)::int`,
		})
		.from(event)
		.where(and(gte(event.time, start), lt(event.time, end)));

	// 总事件数
	const totalResult = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(event)
		.where(and(gte(event.time, start), lt(event.time, end)));

	const timeSeries: TimeSeriesItem[] = (
		(timeSeriesResult as unknown as { rows: { date: string; count: number }[] })
			.rows ?? []
	).map((r) => ({ date: r.date, count: r.count }));

	const eventDistribution: EventDistributionItem[] = distributionResult.map(
		(r) => ({ event: r.event, count: r.count }),
	);

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
// 预设事件管理
// ═══════════════════════════════════════════════════

/** 获取预设事件列表 */
export async function getPresetEventList(): Promise<PresetEventRecord[]> {
	return db
		.select()
		.from(presetEvent)
		.orderBy(presetEvent.category, presetEvent.name);
}

/** 获取单个预设事件 */
export async function getPresetEvent(
	name: string,
): Promise<PresetEventRecord | null> {
	const rows = await db
		.select()
		.from(presetEvent)
		.where(eq(presetEvent.name, name))
		.limit(1);
	return rows[0] ?? null;
}

/** 创建预设事件 */
export async function createPresetEvent(
	name: string,
	input: PresetEventInput,
): Promise<PresetEventRecord> {
	const [row] = await db
		.insert(presetEvent)
		.values({
			name,
			label: input.label,
			category: input.category,
			description: input.description ?? null,
		})
		.returning();
	invalidatePresetCache();
	return row;
}

/** 更新预设事件 */
export async function updatePresetEvent(
	name: string,
	input: Partial<PresetEventInput>,
): Promise<PresetEventRecord | null> {
	const existing = await getPresetEvent(name);
	if (!existing) return null;

	const [row] = await db
		.update(presetEvent)
		.set({
			...(input.label !== undefined ? { label: input.label } : {}),
			...(input.category !== undefined ? { category: input.category } : {}),
			...(input.description !== undefined
				? { description: input.description }
				: {}),
			updatedAt: new Date(),
		})
		.where(eq(presetEvent.name, name))
		.returning();
	invalidatePresetCache();
	return row ?? null;
}

/** 删除预设事件（预置事件不可删除） */
export async function deletePresetEvent(name: string): Promise<boolean> {
	const existing = await getPresetEvent(name);
	if (!existing || existing.isPreset) return false;

	await db.delete(presetEvent).where(eq(presetEvent.name, name));
	invalidatePresetCache();
	return true;
}

// ═══════════════════════════════════════════════════
// 预设属性管理
// ═══════════════════════════════════════════════════

/** 获取预设属性列表 */
export async function getPresetPropertyList(): Promise<PresetPropertyRecord[]> {
	return db.select().from(presetProperty).orderBy(presetProperty.key);
}

/** 获取单个预设属性 */
export async function getPresetProperty(
	key: string,
): Promise<PresetPropertyRecord | null> {
	const rows = await db
		.select()
		.from(presetProperty)
		.where(eq(presetProperty.key, key))
		.limit(1);
	return rows[0] ?? null;
}

/** 创建预设属性 */
export async function createPresetProperty(
	key: string,
	input: PresetPropertyInput,
): Promise<PresetPropertyRecord> {
	const [row] = await db
		.insert(presetProperty)
		.values({
			key,
			label: input.label,
			dataType: input.dataType ?? "string",
			description: input.description ?? null,
		})
		.returning();
	invalidatePresetCache();
	return row;
}

/** 更新预设属性 */
export async function updatePresetProperty(
	key: string,
	input: Partial<PresetPropertyInput>,
): Promise<PresetPropertyRecord | null> {
	const existing = await getPresetProperty(key);
	if (!existing) return null;

	const [row] = await db
		.update(presetProperty)
		.set({
			...(input.label !== undefined ? { label: input.label } : {}),
			...(input.dataType !== undefined ? { dataType: input.dataType } : {}),
			...(input.description !== undefined
				? { description: input.description }
				: {}),
			updatedAt: new Date(),
		})
		.where(eq(presetProperty.key, key))
		.returning();
	invalidatePresetCache();
	return row ?? null;
}

/** 删除预设属性（预置属性不可删除） */
export async function deletePresetProperty(key: string): Promise<boolean> {
	const existing = await getPresetProperty(key);
	if (!existing || existing.isPreset) return false;

	await db.delete(presetProperty).where(eq(presetProperty.key, key));
	invalidatePresetCache();
	return true;
}

// ═══════════════════════════════════════════════════
// 预置数据初始化
// ═══════════════════════════════════════════════════

/** 预置事件定义 */
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
		name: "Click",
		label: "元素点击",
		category: "页面交互",
		description: "用户点击按钮、链接等可交互元素",
	},
	{
		name: "FormSubmit",
		label: "表单提交",
		category: "用户行为",
		description: "用户提交表单时触发",
	},
	{
		name: "Search",
		label: "搜索行为",
		category: "用户行为",
		description: "用户执行搜索时触发",
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
		name: "Share",
		label: "内容分享",
		category: "内容互动",
		description: "用户分享内容时触发",
	},
	{
		name: "Scroll",
		label: "页面滚动",
		category: "页面交互",
		description: "用户滚动页面达一定深度时触发",
	},
	{
		name: "Logout",
		label: "用户退出",
		category: "用户行为",
		description: "用户主动退出登录时触发",
	},
];

/** 预置属性定义 */
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
		key: "element_id",
		label: "元素 ID",
		dataType: "string",
		description: "被点击元素的 ID",
	},
	{
		key: "element_text",
		label: "元素文本",
		dataType: "string",
		description: "被点击元素的文本内容",
	},
	{
		key: "scroll_depth",
		label: "滚动深度",
		dataType: "number",
		description: "页面滚动深度百分比（25/50/75/100）",
	},
	{
		key: "form_name",
		label: "表单名称",
		dataType: "string",
		description: "被提交的表单名称（如 clientLogin、clientRegister）",
	},
	{
		key: "search_query",
		label: "搜索关键词",
		dataType: "string",
		description: "用户执行的搜索关键词",
	},
	{
		key: "share_platform",
		label: "分享平台",
		dataType: "string",
		description: "内容分享的目标平台",
	},
];

/** 初始化预置事件（首次启动时调用，已存在则跳过，完成后刷新缓存） */
export async function ensurePresetEvents(): Promise<void> {
	for (const pe of PRESET_EVENTS) {
		const existing = await getPresetEvent(pe.name);
		if (!existing) {
			await db.insert(presetEvent).values({
				name: pe.name,
				label: pe.label,
				category: pe.category,
				description: pe.description,
				isPreset: true,
			});
		}
	}
	invalidatePresetCache();
}

/** 初始化预置属性（首次启动时调用，已存在则跳过，完成后刷新缓存） */
export async function ensurePresetProperties(): Promise<void> {
	for (const pp of PRESET_PROPERTIES) {
		const existing = await getPresetProperty(pp.key);
		if (!existing) {
			await db.insert(presetProperty).values({
				key: pp.key,
				label: pp.label,
				dataType: pp.dataType,
				description: pp.description,
				isPreset: true,
			});
		}
	}
	invalidatePresetCache();
}
