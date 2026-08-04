/**
 * 客户端鉴权中间件：登录校验 + 权限控制
 * 统一为 request middleware，同时支持 Server Function 和 Server Route
 */
import { createMiddleware } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { COOKIE_NAMES, verifyToken } from "#/lib/jwt/jwt";
import {
	type ClientPermissionDef,
	hasClientPermission,
} from "#/lib/permissions/client-permissions";
import { runWithRequestContext } from "#/lib/request-context/request-context";

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
 * 客户端鉴权核心逻辑：校验 token 并返回用户上下文
 * 不涉及 Cookie 读取，由中间件层传入
 */
async function resolveClientAuthContext(
	token: string | undefined,
): Promise<ClientAuthContext> {
	if (!token) {
		throw new ClientAuthError("请先登录", 401);
	}

	const payload = await verifyToken(token);
	if (!payload || payload.userType !== "client") {
		throw new ClientAuthError("无效的用户身份", 401);
	}

	// 动态 import 服务层：中间件仅服务端执行，客户端 RPC stub 不加载 .server 依赖
	const { getClientUserForAuth } = await import(
		"#/services/client-auth/client-auth.server"
	);
	const result = await getClientUserForAuth(payload.userId);
	if (!result.success) {
		if (result.reason === "not_found") {
			throw new ClientAuthError("用户不存在", 401);
		}
		throw new ClientAuthError("账号已被禁用", 403);
	}

	return {
		userId: result.id,
		username: result.username,
		email: result.email,
		rolePermissions: result.rolePermissions,
	};
}

/**
 * 客户端登录校验中间件：读取客户端 Cookie，调用 resolveClientAuthContext 校验身份
 * 适用场景：需要认证但不校验权限码的接口（如用户操作自己的消息）
 */
export const clientAuthGuard = createMiddleware().server(async ({ next }) => {
	const token = getCookie(COOKIE_NAMES.CLIENT_TOKEN);
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
