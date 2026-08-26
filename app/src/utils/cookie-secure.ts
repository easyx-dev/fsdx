/**
 * Cookie Secure 标志决策：生产环境默认启用，支持 COOKIE_SECURE 环境变量显式覆盖
 * 线上未启用 HTTPS（http:// 直连或反代）时须设 COOKIE_SECURE=false，
 * 否则浏览器不保存带 Secure 标志的 Cookie，登录成功后 token 立即丢失、反复跳回登录页
 */

/**
 * 计算认证 Cookie 是否携带 Secure 标志
 * 优先级：COOKIE_SECURE 环境变量（true/1 开启，false/0 关闭）> 生产环境默认开启
 */
export function isCookieSecure(): boolean {
	const raw = process.env.COOKIE_SECURE;
	if (raw === "true" || raw === "1") return true;
	if (raw === "false" || raw === "0") return false;
	return process.env.NODE_ENV === "production";
}
