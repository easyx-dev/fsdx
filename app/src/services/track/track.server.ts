/**
 * 埋点事件服务层入口：事件上报缓冲写入 + 各子模块统一导出（barrel）
 * 事件校验/频控/时间钳制 → track.validate；元数据管理 → track.meta；查询分析 → track.analytics
 */
import { BatchWriter } from "@fsdx/core/batch-writer";
import { db } from "#/db/index";
import { trackEvent as trackEventTable } from "#/db/schema";
import { logger } from "#/lib/logger/logger";
import {
	trackEventMetaCache,
	trackPropertyMetaCache,
} from "#/services/track/track.cache";
import { isTrackMetaCacheLoaded, loadTrackMetaCache } from "./track.meta";
import type { TrackEventInput } from "./track.types";
import {
	clampTrackEventTime,
	isTrackSessionRateLimited,
	isValidTrackPropertyValue,
} from "./track.validate";

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
	logger,
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
	if (isTrackSessionRateLimited(input.sessionId)) {
		logger.warn(
			{ sessionId: input.sessionId, ip: input.ip },
			"埋点事件被丢弃：会话上报频率超限",
		);
		return;
	}

	// 时间钳制：异常客户端时间以服务端时间为准
	const time = clampTrackEventTime(input.time);
	if (time !== input.time) {
		logger.warn(
			{ originalTime: input.time, sessionId: input.sessionId, ip: input.ip },
			"埋点事件时间超出合理区间，已改用服务端时间",
		);
	}

	// 缓存未就绪时不校验，允许写入（启动阶段兜底）
	if (!isTrackMetaCacheLoaded()) {
		loadTrackMetaCache().catch((err) => {
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

		if (!isValidTrackPropertyValue(value, expectedType)) {
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
// 统一导出（barrel）
// ═══════════════════════════════════════════════════

export {
	getTrackAnalytics,
	getTrackEventNames,
	searchTrackEvents,
} from "./track.analytics";
export {
	createTrackEventMeta,
	createTrackPropertyMeta,
	deleteTrackEventMeta,
	deleteTrackPropertyMeta,
	ensurePresetEvents,
	ensurePresetProperties,
	getTrackEventMeta,
	getTrackEventMetaList,
	getTrackPropertyMeta,
	getTrackPropertyMetaList,
	loadTrackMetaCache,
	resetTrackMetaCacheForTest,
	updateTrackEventMeta,
	updateTrackPropertyMeta,
} from "./track.meta";
export type {
	JsonProperties,
	JsonValue,
	TimeSeriesItem,
	TopPageItem,
	TrackAnalyticsQuery,
	TrackAnalyticsResult,
	TrackEventDistributionItem,
	TrackEventInput,
	TrackEventMetaInput,
	TrackEventMetaRecord,
	TrackEventQuery,
	TrackEventQueryResult,
	TrackEventRecord,
	TrackPropertyMetaInput,
	TrackPropertyMetaRecord,
} from "./track.types";
export {
	clearTrackRateLimit,
	TRACK_RATE_LIMIT,
} from "./track.validate";
