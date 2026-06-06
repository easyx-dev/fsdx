/**
 * 管理端布局路由：beforeLoad 鉴权守卫
 * 所有 /admin/* 受保护页面在此布局内，login 页面除外
 * 同时导出管理端共享的认证 SF：getCurrentUserFn、logout
 */

import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getCookie } from "@tanstack/react-start/server";
import { COOKIE_NAMES } from "#/lib/jwt";
import { getCurrentUser } from "#/server/auth/current-user";

/**
 * 获取当前登录用户信息
 * 从请求 Cookie 中解析 JWT，查数据库返回完整用户信息
 * 返回 null 表示未登录或 token 无效
 */
export const getCurrentUserFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const token = getCookie(COOKIE_NAMES.ACCESS_TOKEN);
		return getCurrentUser(token);
	},
);

/** 退出登录：清除认证 Cookie */
export const logout = createServerFn({ method: "POST" }).handler(async () => {
	deleteCookie(COOKIE_NAMES.ACCESS_TOKEN, { path: "/" });
	return { success: true };
});

export const Route = createFileRoute("/admin/_admin")({
	beforeLoad: async ({ location }) => {
		const user = await getCurrentUserFn();

		if (!user || user.userType !== "admin") {
			throw redirect({
				to: "/admin/login",
				search: { redirect: location.href },
			});
		}

		return { user };
	},
});
