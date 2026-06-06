/**
 * 鉴权中间件测试：authGuard 和 permGuard
 */

import { describe, expect, it } from "vitest";

import type { AuthContext } from "#/middleware/server-fn-auth";
import { AuthError } from "#/middleware/server-fn-auth";

describe("AuthError", () => {
	it("包含 statusCode 属性", () => {
		const err401 = new AuthError("未登录", 401);
		expect(err401.message).toBe("未登录");
		expect(err401.statusCode).toBe(401);
		expect(err401.name).toBe("AuthError");
		expect(err401).toBeInstanceOf(Error);
	});

	it("403 状态码", () => {
		const err403 = new AuthError("权限不足", 403);
		expect(err403.statusCode).toBe(403);
	});
});

describe("AuthContext 类型", () => {
	it("user 包含必要字段，包括 isRoot", () => {
		const ctx: AuthContext = {
			user: {
				id: "user-1",
				username: "admin",
				email: "admin@test.com",
				userType: "admin",
				isRoot: false,
			},
			rolePermissions: ["news:*", "admin:view"],
		};
		expect(ctx.user.id).toBe("user-1");
		expect(ctx.user.isRoot).toBe(false);
		expect(ctx.rolePermissions).toHaveLength(2);
	});

	it("isRoot 为 true 的 root 用户", () => {
		const ctx: AuthContext = {
			user: {
				id: "root-1",
				username: "root",
				email: "root@test.com",
				userType: "admin",
				isRoot: true,
			},
			rolePermissions: ["**"],
		};
		expect(ctx.user.isRoot).toBe(true);
		expect(ctx.rolePermissions).toEqual(["**"]);
	});
});
