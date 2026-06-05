/**
 * 管理端布局路由：beforeLoad 鉴权守卫
 * 所有 /admin/* 受保护页面在此布局内，login 页面除外
 */

import { createFileRoute, redirect } from "@tanstack/react-router";
import { getCurrentUserFn } from "#/server/auth/current-user";

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
