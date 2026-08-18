/**
 * 请求 ID 中间件：为每个请求透传或生成关联 ID（requestId）
 * 写入 ALS 上下文并回写响应头 x-request-id，供日志与操作审计链路追踪
 */
import { randomUUID } from "node:crypto";
import { runWithRequestContext } from "@fsdx/core/request-context";
import { createMiddleware } from "@tanstack/react-start";
import {
	getRequestHeader,
	setResponseHeader,
} from "@tanstack/react-start/server";

/** 请求关联 ID 的请求/响应头名称 */
export const REQUEST_ID_HEADER = "x-request-id";

/**
 * requestId 最大长度，与 operation_log.request_id 列长度（varchar(100)）保持一致
 * 上游透传的 x-request-id 为不可信输入，超长会导致审计表 BatchWriter 整批写入失败
 */
export const MAX_REQUEST_ID_LENGTH = 100;

/**
 * 全局请求 ID 中间件：优先透传上游 x-request-id（支持跨服务追踪），否则生成 UUID
 * 透传值做长度截断，防止超长值污染日志与审计表
 * 注册在 start.ts requestMiddleware 首位，确保下游鉴权中间件合并上下文时保留 requestId
 */
export const requestIdMiddleware = createMiddleware().server(
	async ({ next }) => {
		const raw = getRequestHeader(REQUEST_ID_HEADER) || randomUUID();
		const requestId = raw.slice(0, MAX_REQUEST_ID_LENGTH);
		setResponseHeader(REQUEST_ID_HEADER, requestId);
		return runWithRequestContext({ requestId }, () => next());
	},
);
