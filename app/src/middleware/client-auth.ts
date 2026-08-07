/**
 * 客户端鉴权中间件：登录校验 + 权限控制
 * 统一为 request middleware，同时支持 Server Function 和 Server Route
 */

import { runWithRequestContext } from "@fsdx/core/request-context";
import { createMiddleware } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { COOKIE_NAMES } from "#/constants/cookie-names";
import {
	type ClientPermissionDef,
	hasClientPermission,
} from "#/permissions/client-permissions";

/** 通过中间件注入 handler 的客户端用户上下文 */
export interface ClientAuthContext {
	userId: string;
	username: string;
	email: string;
	rolePermissions: string[];
}

/** 客户端鉴权错误 */
export class ClientAuthError extends Error {
	statusCode: number;

	constructor(message: string, statusCode: number) {
		super(message);
		this.statusCode = statusCode;
		this.name = "ClientAuthError";
	}
}

/**
 * 客户端登录校验中间件：读取客户端 Cookie，调用 resolveClientAuthContext 校验身份
 * 适用场景：需要认证但不校验权限码的接口（如用户操作自己的消息）
 */
export const clientAuthGuard = createMiddleware().server(async ({ next }) => {
	const token = getCookie(COOKIE_NAMES.CLIENT_TOKEN);
	const { resolveClientAuthContext } = await import(
		"#/middleware/client-auth.server"
	);
	const ctx = await resolveClientAuthContext(token);
	return runWithRequestContext(
		{
			operator: {
				id: ctx.userId,
				username: ctx.username,
				email: ctx.email,
				type: "client",
			},
		},
		() => next({ context: ctx }),
	);
});

/**
 * 客户端权限校验中间件工厂
 * 直接调用 resolveClientAuthContext 完成登录校验和权限校验
 * Server Function 和 Server Route 通用
 */
export function clientPermGuard(required: ClientPermissionDef) {
	return createMiddleware().server(async ({ next }) => {
		const token = getCookie(COOKIE_NAMES.CLIENT_TOKEN);
		const { resolveClientAuthContext } = await import(
			"#/middleware/client-auth.server"
		);
		const ctx = await resolveClientAuthContext(token);
		if (!hasClientPermission(ctx.rolePermissions, required)) {
			throw new ClientAuthError("权限不足", 403);
		}
		return runWithRequestContext(
			{
				operator: {
					id: ctx.userId,
					username: ctx.username,
					email: ctx.email,
					type: "client",
				},
			},
			() => next({ context: ctx }),
		);
	});
}

/**
 * Server Route 专用客户端权限守卫
 * 组合 clientPermGuard，捕获 ClientAuthError 转为对应 HTTP 状态码 JSON，避免中间件抛错被框架统一转 500
 */
export function clientPermRouteGuard(required: ClientPermissionDef) {
	const guard = clientPermGuard(required);
	return createMiddleware()
		.middleware([guard])
		.server(async ({ next }) => {
			try {
				return await next();
			} catch (err) {
				if (err instanceof ClientAuthError) {
					return new Response(JSON.stringify({ error: err.message }), {
						status: err.statusCode,
						headers: { "Content-Type": "application/json" },
					});
				}
				throw err;
			}
		});
}
