/**
 * JWT 模块：签发和校验 access token
 */
import { jwtVerify, SignJWT } from "jose";
import { logger } from "#/lib/logger/logger";

let _jwtSecret: Uint8Array | null = null;

function getJwtSecret(): Uint8Array {
	if (!_jwtSecret) {
		const secret = process.env.JWT_SECRET;
		if (!secret) {
			throw new Error("环境变量 JWT_SECRET 未配置，无法签发 JWT Token");
		}
		_jwtSecret = new TextEncoder().encode(secret);
	}
	return _jwtSecret;
}

/** Access Token 有效期：7 天 */
const ACCESS_TOKEN_EXPIRES = "7d";

/** JWT 载荷 */
export interface JwtPayload {
	userId: string;
	username: string;
	/** admin 或 client */
	userType: "admin" | "client";
}

/**
 * 签发 JWT Token
 */
export async function signToken(payload: JwtPayload): Promise<string> {
	return new SignJWT({ ...payload })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime(ACCESS_TOKEN_EXPIRES)
		.sign(getJwtSecret());
}

/**
 * 校验 JWT Token
 */
export async function verifyToken(token: string): Promise<JwtPayload | null> {
	try {
		const { payload } = await jwtVerify(token, getJwtSecret());
		return payload as unknown as JwtPayload;
	} catch (err) {
		logger.error({ error: (err as Error).message }, "JWT 校验失败");
		return null;
	}
}

/**
 * Cookie 名称
 * 管理端和客户端使用独立的 Cookie，避免同一浏览器同时登录时互相覆盖
 */
export const COOKIE_NAMES = {
	/** 管理端 JWT Token Cookie */
	ADMIN_TOKEN: "fsdx_admin_token",
	/** 客户端 JWT Token Cookie */
	CLIENT_TOKEN: "fsdx_client_token",
} as const;
