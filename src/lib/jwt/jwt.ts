/**
 * JWT 模块：签发和校验 access token
 */
import { jwtVerify, SignJWT } from "jose";
import { getEnv } from "#/lib/env";
import { logger } from "#/lib/logger";

/** JWT 配置 */
const JWT_SECRET = new TextEncoder().encode(getEnv().JWT_SECRET);

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
		.sign(JWT_SECRET);
}

/**
 * 校验 JWT Token
 */
export async function verifyToken(token: string): Promise<JwtPayload | null> {
	try {
		const { payload } = await jwtVerify(token, JWT_SECRET);
		return payload as unknown as JwtPayload;
	} catch (err) {
		logger.error({ err }, "JWT 校验失败");
		return null;
	}
}

/**
 * Cookie 名称
 */
export const COOKIE_NAMES = {
	ACCESS_TOKEN: "cms_access_token",
} as const;
