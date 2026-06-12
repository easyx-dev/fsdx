/**
 * 管理端布局路由：beforeLoad 鉴权守卫
 * 所有 /admin/* 受保护页面在此布局内，login 页面除外
 * 同时导出管理端共享的认证 SF：getCurrentAdminSFn、logoutSFn
 */

import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getCookie } from "@tanstack/react-start/server";
import { COOKIE_NAMES } from "#/lib/jwt/jwt";
import { getCurrentAdmin } from "#/server/admin-auth/admin-auth.server";

/**
 * 获取当前登录管理员信息
 * 从请求 Cookie 中解析 JWT，查数据库返回完整管理员信息
 * 返回 null 表示未登录或 token 无效
 */
export const getCurrentAdminSFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const token = getCookie(COOKIE_NAMES.ADMIN_TOKEN);
		return getCurrentAdmin(token);
	},
);

/** 退出登录：清除管理端认证 Cookie */
export const logoutSFn = createServerFn({ method: "POST" }).handler(
	async () => {
		deleteCookie(COOKIE_NAMES.ADMIN_TOKEN, { path: "/" });
		return { success: true };
	},
);

export const Route = createFileRoute("/admin/_admin")({
	ssr: false,
	head: async () => {
		return {
			styles: [],
		};
	},
	beforeLoad: async ({ location }) => {
		const user = await getCurrentAdminSFn();

		if (!user || user.userType !== "admin") {
			throw redirect({
				to: "/admin/login",
				search: { redirect: location.href },
			});
		}

		return { user };
	},
});
