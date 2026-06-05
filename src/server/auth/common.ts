/**
 * 认证通用：退出登录
 */
import { createServerFn } from "@tanstack/react-start";
import { deleteCookie } from "@tanstack/react-start/server";
import { COOKIE_NAMES } from "#/lib/jwt";

/** 退出登录：清除所有认证 Cookie */
export const logout = createServerFn({ method: "POST" }).handler(async () => {
	deleteCookie(COOKIE_NAMES.ACCESS_TOKEN, { path: "/" });
	return { success: true };
});
