/**
 * Cookie 名称常量：管理端与客户端使用独立 Cookie，避免同一浏览器同时登录互相覆盖
 */
export const COOKIE_NAMES = {
	/** 管理端 JWT Token Cookie */
	ADMIN_TOKEN: "fsdx_admin_token",
	/** 客户端 JWT Token Cookie */
	CLIENT_TOKEN: "fsdx_client_token",
} as const;
