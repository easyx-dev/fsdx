/**
 * 埋点事件 Server Function 包装器
 */
import { createServerFn } from "@tanstack/react-start";

/** 预设属性支持的数据类型 */
export const PROPERTY_DATA_TYPES = [
	{ label: "string", value: "string" },
	{ label: "number", value: "number" },
	{ label: "boolean", value: "boolean" },
	{ label: "date", value: "date" },
	{ label: "array", value: "array" },
	{ label: "object", value: "object" },
] as const;

import { z } from "zod";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import {
	createPresetEvent,
	createPresetProperty,
	deletePresetEvent,
	deletePresetProperty,
	getEventAnalytics,
	getEventNames,
	getPresetEventList,
	getPresetPropertyList,
	searchEvents,
	trackEvent,
	updatePresetEvent,
	updatePresetProperty,
} from "./event.server";

// ─── 事件追踪（公开接口，无鉴权） ───

const trackEventSchema = z.object({
	time: z.number(),
	userId: z.string().optional(),
	sessionId: z.string().min(1),
	event: z.string().min(1).max(100),
	properties: z.record(z.string(), z.unknown()).default({}),
});

/**
 * 接收客户端埋点事件（公开接口，无需鉴权）
 * 事件进入内存缓冲队列，异步批量写入数据库
 */
export const trackEventFn = createServerFn({ method: "POST" })
	.inputValidator(trackEventSchema)
	.handler(async ({ data }) => {
		trackEvent(data);
		return { success: true };
	});

// ─── 事件查询 ───

const eventQuerySchema = z.object({
	event: z.string().optional(),
	userId: z.string().optional(),
	sessionId: z.string().optional(),
	keyword: z.string().optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	page: z.number().int().min(1).optional(),
	pageSize: z.number().int().min(1).max(100).optional(),
	sortField: z.string().optional(),
	sortOrder: z.enum(["ascend", "descend"]).optional(),
});

/** 分页查询埋点事件 */
export const searchEventsFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.EVENT_QUERY)])
	.inputValidator(eventQuerySchema)
	.handler(async ({ data }) => searchEvents(data));

/** 获取已有的事件名称列表 */
export const getEventNamesFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.EVENT_QUERY)])
	.handler(async () => getEventNames());

// ─── 事件分析 ───

const analyticsQuerySchema = z.object({
	startDate: z.string().min(1),
	endDate: z.string().min(1),
	granularity: z.enum(["hour", "day"]).optional(),
});

/** 获取事件分析数据 */
export const getEventAnalyticsFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.EVENT_QUERY)])
	.inputValidator(analyticsQuerySchema)
	.handler(async ({ data }) => getEventAnalytics(data));

// ─── 预设事件管理 ───

/** 获取预设事件列表 */
export const getPresetEventsFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.EVENT_VIEW)])
	.handler(async () => getPresetEventList());

const presetEventCreateSchema = z.object({
	name: z.string().min(1).max(100),
	label: z.string().min(1).max(100),
	category: z.string().min(1).max(50),
	description: z.string().optional(),
});

const presetEventUpdateSchema = z.object({
	name: z.string().min(1).max(100),
	label: z.string().min(1).max(100).optional(),
	category: z.string().min(1).max(50).optional(),
	description: z.string().optional(),
});

const presetEventDeleteSchema = z.object({
	name: z.string().min(1).max(100),
});

/** 创建预设事件 */
export const createPresetEventFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.EVENT_MANAGE)])
	.inputValidator(presetEventCreateSchema)
	.handler(async ({ data }) => {
		const { name, ...input } = data;
		return createPresetEvent(name, input);
	});

/** 更新预设事件 */
export const updatePresetEventFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.EVENT_MANAGE)])
	.inputValidator(presetEventUpdateSchema)
	.handler(async ({ data }) => {
		const { name, ...input } = data;
		return updatePresetEvent(name, input);
	});

/** 删除预设事件 */
export const deletePresetEventFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.EVENT_MANAGE)])
	.inputValidator(presetEventDeleteSchema)
	.handler(async ({ data }) => deletePresetEvent(data.name));

// ─── 预设属性管理 ───

/** 获取预设属性列表 */
export const getPresetPropertiesFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.EVENT_VIEW)])
	.handler(async () => getPresetPropertyList());

const presetPropertyCreateSchema = z.object({
	key: z.string().min(1).max(100),
	label: z.string().min(1).max(100),
	dataType: z.string().optional(),
	description: z.string().optional(),
});

const presetPropertyUpdateSchema = z.object({
	key: z.string().min(1).max(100),
	label: z.string().min(1).max(100).optional(),
	dataType: z.string().optional(),
	description: z.string().optional(),
});

const presetPropertyDeleteSchema = z.object({
	key: z.string().min(1).max(100),
});

/** 创建预设属性 */
export const createPresetPropertyFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.EVENT_MANAGE)])
	.inputValidator(presetPropertyCreateSchema)
	.handler(async ({ data }) => {
		const { key, ...input } = data;
		return createPresetProperty(key, input);
	});

/** 更新预设属性 */
export const updatePresetPropertyFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.EVENT_MANAGE)])
	.inputValidator(presetPropertyUpdateSchema)
	.handler(async ({ data }) => {
		const { key, ...input } = data;
		return updatePresetProperty(key, input);
	});

/** 删除预设属性 */
export const deletePresetPropertyFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.EVENT_MANAGE)])
	.inputValidator(presetPropertyDeleteSchema)
	.handler(async ({ data }) => deletePresetProperty(data.key));
