/**
 * JWT 模块：签发和校验 access token
 * createJwt 工厂注入密钥与日志实例；模块自身不持有全局单例与 Cookie 命名约定
 * Cookie 名称约定由宿主应用持有（见 app/src/constants/cookie-names.ts）
 */
import { jwtVerify, SignJWT } from "jose";
import type { Logger } from "./logger";

/** JWT 载荷 */
export interface JwtPayload {
	userId: string;
	username: string;
	/** admin 或 client */
	userType: "admin" | "client";
}

/** Access Token 有效期：7 天 */
const ACCESS_TOKEN_EXPIRES = "7d";

/** JWT 签发/校验模块 */
export interface JwtModule {
	/** 签发 JWT Token */
	signToken(payload: JwtPayload): Promise<string>;
	/** 校验 JWT Token，无效返回 null */
	verifyToken(token: string): Promise<JwtPayload | null>;
}

/**
 * 创建 JWT 签发/校验模块
 * @param opts.secret JWT 密钥
 * @param opts.logger 日志实例
 */
export function createJwt(opts: { secret: string; logger: Logger }): JwtModule {
	const key = new TextEncoder().encode(opts.secret);

	return {
		async signToken(payload: JwtPayload): Promise<string> {
			// 运行时校验密钥，保证 fail-fast 且不阻断模块加载
			if (!opts.secret) {
				throw new Error("环境变量 JWT_SECRET 未配置，无法签发 JWT Token");
			}
			return new SignJWT({ ...payload })
				.setProtectedHeader({ alg: "HS256" })
				.setIssuedAt()
				.setExpirationTime(ACCESS_TOKEN_EXPIRES)
				.sign(key);
		},
		async verifyToken(token: string): Promise<JwtPayload | null> {
			try {
				const { payload } = await jwtVerify(token, key);
				return payload as unknown as JwtPayload;
			} catch (err) {
				opts.logger.debug({ error: (err as Error).message }, "JWT 校验失败");
				return null;
			}
		},
	};
}
