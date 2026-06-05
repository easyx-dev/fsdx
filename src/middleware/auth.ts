/**
 * 鉴权中间件：管理端路由鉴权和权限校验
 */
import { COOKIE_NAMES, type JwtPayload, verifyToken } from "#/lib/jwt";
import { hasPermission, type PermissionDef } from "#/lib/permissions";

/**
 * 从请求头 Cookie 中提取指定 cookie 值
 */
function getCookie(cookieHeader: string, name: string): string | undefined {
	const match = cookieHeader
		.split(";")
		.map((c) => c.trim())
		.find((c) => c.startsWith(`${name}=`));
	return match ? match.slice(name.length + 1) : undefined;
}

/**
 * 从请求 Cookie 中解析 JWT 并返回用户信息
 * 返回 null 表示未登录或 token 无效
 */
export async function getAuthUser(
	cookieHeader?: string | null,
): Promise<JwtPayload | null> {
	if (!cookieHeader) return null;
	const token = getCookie(cookieHeader, COOKIE_NAMES.ACCESS_TOKEN);
	if (!token) return null;
	return verifyToken(token);
}

/**
 * 要求管理员登录，返回用户信息或抛出 AuthError
 */
export async function requireAdminAuth(
	cookieHeader?: string | null,
): Promise<JwtPayload> {
	const user = await getAuthUser(cookieHeader);

	if (!user) {
		throw new AuthError("未登录或登录已过期", 401);
	}

	if (user.userType !== "admin") {
		throw new AuthError("无权访问管理端", 403);
	}

	return user;
}

/**
 * 校验权限，无权限时抛出 AuthError
 * 应在 requireAdminAuth 之后调用，传入从 role 表查出的权限列表
 */
export function requirePermission(
	rolePermissions: string[],
	required: PermissionDef,
): void {
	if (!hasPermission(rolePermissions, required)) {
		throw new AuthError("权限不足", 403);
	}
}

/** 鉴权错误 */
export class AuthError extends Error {
	statusCode: number;

	constructor(message: string, statusCode: number) {
		super(message);
		this.statusCode = statusCode;
		this.name = "AuthError";
	}
}
