/**
 * JWT 模块：签发和校验 access token 与 refresh token
 */
import { jwtVerify, SignJWT } from "jose";
import { getEnv } from "#/lib/env";

/** JWT 配置 */
const JWT_SECRET = new TextEncoder().encode(getEnv().JWT_SECRET);
const JWT_REFRESH_SECRET = new TextEncoder().encode(
	getEnv().JWT_REFRESH_SECRET,
);

/** Access Token 有效期：1 小时 */
const ACCESS_TOKEN_EXPIRES = "1h";
/** Refresh Token 有效期：7 天 */
const REFRESH_TOKEN_EXPIRES = "7d";

/** JWT 载荷 */
export interface JwtPayload {
	userId: string;
	username: string;
	/** admin 或 client */
	userType: "admin" | "client";
}

/** Token 类型 */
export type TokenType = "access" | "refresh";

const SECRETS: Record<TokenType, Uint8Array> = {
	access: JWT_SECRET,
	refresh: JWT_REFRESH_SECRET,
};

const EXPIRES: Record<TokenType, string> = {
	access: ACCESS_TOKEN_EXPIRES,
	refresh: REFRESH_TOKEN_EXPIRES,
};

/**
 * 签发 JWT Token
 */
export async function signToken(
	payload: JwtPayload,
	type: TokenType = "access",
): Promise<string> {
	return new SignJWT({ ...payload })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime(EXPIRES[type])
		.sign(SECRETS[type]);
}

/**
 * 校验 JWT Token
 */
export async function verifyToken(
	token: string,
	type: TokenType = "access",
): Promise<JwtPayload | null> {
	try {
		const { payload } = await jwtVerify(token, SECRETS[type]);
		return payload as unknown as JwtPayload;
	} catch {
		return null;
	}
}

/**
 * 签发 access + refresh token 对
 */
export async function signTokenPair(
	payload: JwtPayload,
): Promise<{ accessToken: string; refreshToken: string }> {
	const [accessToken, refreshToken] = await Promise.all([
		signToken(payload, "access"),
		signToken(payload, "refresh"),
	]);
	return { accessToken, refreshToken };
}

/**
 * Cookie 名称
 */
export const COOKIE_NAMES = {
	ACCESS_TOKEN: "cms_access_token",
	REFRESH_TOKEN: "cms_refresh_token",
} as const;
