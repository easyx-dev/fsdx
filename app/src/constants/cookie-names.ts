/**
 * Cookie 名称：模板中性默认值，项目更名时在此集中修改（与包名、主题名同等对待）
 * 仅服务端使用（鉴权中间件 / 登录 SFn / 测试）；纯常量可在客户端安全引用
 */
export const COOKIE_NAMES = {
	/** 管理端 JWT Token Cookie */
	ADMIN_TOKEN: "admin_token",
	/** 客户端 JWT Token Cookie */
	CLIENT_TOKEN: "client_token",
} as const;
