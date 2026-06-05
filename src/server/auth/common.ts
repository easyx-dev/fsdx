/**
 * 认证通用：Token 刷新、退出登录
 */
import { createServerFn } from "@tanstack/react-start";
import {
	deleteCookie,
	getCookie,
	setCookie,
} from "@tanstack/react-start/server";
import { COOKIE_NAMES, signToken, verifyToken } from "#/lib/jwt";

/** 刷新 access token */
export const refreshToken = createServerFn({ method: "POST" }).handler(
	async () => {
		const token = getCookie(COOKIE_NAMES.REFRESH_TOKEN);
		if (!token) {
			return { success: false, message: "未登录" };
		}

		const payload = await verifyToken(token, "refresh");
		if (!payload) {
			return { success: false, message: "登录已过期" };
		}

		const newAccessToken = await signToken(
			{
				userId: payload.userId,
				username: payload.username,
				userType: payload.userType,
			},
			"access",
		);

		setCookie(COOKIE_NAMES.ACCESS_TOKEN, newAccessToken, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
			maxAge: 3600,
		});

		return { success: true };
	},
);

/** 退出登录：清除所有认证 Cookie */
export const logout = createServerFn({ method: "POST" }).handler(async () => {
	deleteCookie(COOKIE_NAMES.ACCESS_TOKEN, { path: "/" });
	deleteCookie(COOKIE_NAMES.REFRESH_TOKEN, { path: "/" });
	return { success: true };
});
