/**
 * 请求级上下文容器：基于 AsyncLocalStorage 在 SFn 调用链中传递请求维度数据
 * 当前承载操作者身份，未来可扩展 requestId、traceId 等
 * OperatorType 在此定义，供宿主应用的 operation_log schema re-export
 */
import { AsyncLocalStorage } from "node:async_hooks";

/** 操作者类型：admin / client / system */
export type OperatorType = "admin" | "client" | "system";

/** 请求级操作者身份 */
export interface RequestOperator {
	/** 用户 ID（system 类型时为 null） */
	id: string | null;
	/** 用户名（system 类型时为 null） */
	username: string | null;
	/** 邮箱（system 类型时为 null） */
	email: string | null;
	/** 操作者类型 */
	type: OperatorType;
}

/** 请求级上下文容器（当前仅操作者身份，未来可扩展） */
export interface RequestContext {
	/** 操作者身份 */
	operator: RequestOperator;
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * 在请求上下文中执行函数，供鉴权中间件包裹 next() 使用
 * 调用链中的所有异步操作均可通过 getRequestContext / getRequestOperator 读取
 */
export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
	return requestContextStorage.run(ctx, fn);
}

/**
 * 获取当前请求上下文（原始读取，无上下文时返回 undefined）
 */
export function getRequestContext(): RequestContext | undefined {
	return requestContextStorage.getStore();
}

/**
 * 获取当前请求的操作者身份（便捷访问器）
 * 无上下文（后台任务、cron 等非 SFn 链路）时兜底返回 system
 */
export function getRequestOperator(): RequestOperator {
	return (
		requestContextStorage.getStore()?.operator ?? {
			id: null,
			username: null,
			email: null,
			type: "system" as const,
		}
	);
}
