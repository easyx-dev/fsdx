/**
 * 权限匹配逻辑测试
 * 覆盖 matchPermission / hasPermission / hasAnyPermission / hasAllPermission
 * 及 ** 超级通配符、group:* 分组通配符、精确匹配三种模式
 */

import { describe, expect, it } from "vitest";
import {
	hasAllPermissions,
	hasAnyPermission,
	hasPermission,
	matchPermission,
	PERMISSIONS,
} from "#/lib/permissions/permissions";

// ─── PermissionDef 辅助工具 ───

/** 根据权限码从 PERMISSIONS 常量中查找对应的 PermissionDef */
function findDef(code: string) {
	for (const def of Object.values(PERMISSIONS)) {
		if (def.code === code) return def;
	}
	throw new Error(`未找到权限定义: ${code}`);
}

// ═══════════════════════════════════════════════════════════════════
// matchPermission — 核心匹配函数
// ═══════════════════════════════════════════════════════════════════

describe("matchPermission", () => {
	describe("** 超级通配符", () => {
		it("** 匹配任意权限码", () => {
			expect(matchPermission(["**"], "news:view")).toBe(true);
			expect(matchPermission(["**"], "admin:delete")).toBe(true);
			expect(matchPermission(["**"], "dashboard:view")).toBe(true);
			expect(matchPermission(["**"], "dict:create_item")).toBe(true);
		});

		it("** 在数组任一位置均生效", () => {
			expect(
				matchPermission(["news:view", "**", "dict:edit"], "admin:create"),
			).toBe(true);
			expect(matchPermission(["**", "news:view"], "file:upload")).toBe(true);
		});

		it("仅 ** 一项即可匹配全部", () => {
			expect(matchPermission(["**"], "log:view")).toBe(true);
		});
	});

	describe("group:* 分组通配符", () => {
		it("news:* 匹配所有 news: 前缀权限", () => {
			const perms = ["news:*"];
			expect(matchPermission(perms, "news:view")).toBe(true);
			expect(matchPermission(perms, "news:create")).toBe(true);
			expect(matchPermission(perms, "news:edit")).toBe(true);
			expect(matchPermission(perms, "news:delete")).toBe(true);
			expect(matchPermission(perms, "news:publish")).toBe(true);
		});

		it("dict:* 匹配含下划线的 dict:create_item 等权限", () => {
			const perms = ["dict:*"];
			expect(matchPermission(perms, "dict:create_item")).toBe(true);
			expect(matchPermission(perms, "dict:edit_item")).toBe(true);
			expect(matchPermission(perms, "dict:delete_item")).toBe(true);
		});

		it("news:* 不匹配其他分组权限", () => {
			const perms = ["news:*"];
			expect(matchPermission(perms, "dict:view")).toBe(false);
			expect(matchPermission(perms, "admin:view")).toBe(false);
			expect(matchPermission(perms, "file:upload")).toBe(false);
			expect(matchPermission(perms, "dashboard:view")).toBe(false);
		});

		it("多个分组通配符各自匹配对应分组", () => {
			const perms = ["news:*", "admin:*"];
			expect(matchPermission(perms, "news:view")).toBe(true);
			expect(matchPermission(perms, "admin:create")).toBe(true);
			expect(matchPermission(perms, "admin:delete")).toBe(true);
			expect(matchPermission(perms, "dict:view")).toBe(false);
			expect(matchPermission(perms, "file:upload")).toBe(false);
		});

		it("分组通配符不匹配无冒号的权限码", () => {
			expect(matchPermission(["news:*"], "news")).toBe(false);
		});
	});

	describe("精确匹配", () => {
		it("精确命中", () => {
			expect(matchPermission(["news:view"], "news:view")).toBe(true);
			expect(matchPermission(["admin:delete"], "admin:delete")).toBe(true);
		});

		it("精确不命中", () => {
			expect(matchPermission(["news:view"], "news:create")).toBe(false);
			expect(matchPermission(["admin:view"], "dashboard:view")).toBe(false);
		});
	});

	describe("边界情况", () => {
		it("空权限数组不匹配任何", () => {
			expect(matchPermission([], "news:view")).toBe(false);
			expect(matchPermission([], "**")).toBe(false);
		});

		it("requiredCode 自身为 ** 时精确匹配", () => {
			expect(matchPermission(["**"], "**")).toBe(true);
		});

		it("requiredCode 自身为 group:* 时精确匹配", () => {
			expect(matchPermission(["news:*"], "news:*")).toBe(true);
		});

		it("** 和 group:* 共存时 ** 优先级最高", () => {
			const perms = ["news:*", "**"];
			expect(matchPermission(perms, "admin:view")).toBe(true);
			expect(matchPermission(perms, "dict:create")).toBe(true);
		});

		it("group:* 和精确码共存时均可匹配", () => {
			const perms = ["news:*", "dict:view"];
			expect(matchPermission(perms, "news:create")).toBe(true); // 分组匹配
			expect(matchPermission(perms, "dict:view")).toBe(true); // 精确匹配
			expect(matchPermission(perms, "dict:edit")).toBe(false); // 无匹配
		});
	});
});

// ═══════════════════════════════════════════════════════════════════
// hasPermission — 检查单个权限
// ═══════════════════════════════════════════════════════════════════

describe("hasPermission", () => {
	it("** 通配符命中", () => {
		expect(hasPermission(["**"], findDef("news:view"))).toBe(true);
		expect(hasPermission(["**"], findDef("admin:delete"))).toBe(true);
	});

	it("group:* 通配符命中", () => {
		expect(hasPermission(["news:*"], findDef("news:view"))).toBe(true);
		expect(hasPermission(["news:*"], findDef("news:publish"))).toBe(true);
	});

	it("精确匹配命中", () => {
		expect(
			hasPermission(["news:view", "dict:edit"], findDef("news:view")),
		).toBe(true);
	});

	it("无权限", () => {
		expect(hasPermission(["news:view"], findDef("admin:create"))).toBe(false);
	});

	it("空权限数组", () => {
		expect(hasPermission([], findDef("news:view"))).toBe(false);
	});

	it("含 ** 时忽略其他通配符", () => {
		expect(hasPermission(["**"], PERMISSIONS.DASHBOARD_VIEW)).toBe(true);
	});
});

// ═══════════════════════════════════════════════════════════════════
// hasAnyPermission — 检查任一权限
// ═══════════════════════════════════════════════════════════════════

describe("hasAnyPermission", () => {
	const newsDefs = [
		findDef("news:view"),
		findDef("news:create"),
		findDef("news:delete"),
	];

	it("** 命中任一", () => {
		expect(hasAnyPermission(["**"], newsDefs)).toBe(true);
	});

	it("group:* 覆盖其中至少一项", () => {
		expect(hasAnyPermission(["news:*"], newsDefs)).toBe(true);
	});

	it("至少一项精确命中", () => {
		expect(hasAnyPermission(["news:view", "dict:edit"], newsDefs)).toBe(true);
	});

	it("全部不命中", () => {
		expect(hasAnyPermission(["admin:view", "dict:edit"], newsDefs)).toBe(false);
	});

	it("空权限数组返回 false", () => {
		expect(hasAnyPermission([], newsDefs)).toBe(false);
	});

	it("多个通配符同时存在", () => {
		const crossDefs = [findDef("news:view"), findDef("admin:create")];
		expect(hasAnyPermission(["news:*"], crossDefs)).toBe(true);
		expect(hasAnyPermission(["admin:*"], crossDefs)).toBe(true);
		expect(hasAnyPermission(["dict:*"], crossDefs)).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════════════
// hasAllPermissions — 检查全部权限
// ═══════════════════════════════════════════════════════════════════

describe("hasAllPermissions", () => {
	const newsDefs = [findDef("news:view"), findDef("news:create")];
	const crossDefs = [findDef("news:view"), findDef("admin:create")];

	it("** 命中全部", () => {
		expect(hasAllPermissions(["**"], newsDefs)).toBe(true);
		expect(hasAllPermissions(["**"], crossDefs)).toBe(true);
	});

	it("group:* 覆盖全部同组权限", () => {
		expect(hasAllPermissions(["news:*"], newsDefs)).toBe(true);
	});

	it("group:* 覆盖不完整（跨组要求）", () => {
		expect(hasAllPermissions(["news:*"], crossDefs)).toBe(false);
	});

	it("全部精确命中", () => {
		expect(
			hasAllPermissions(["news:view", "news:create", "dict:edit"], newsDefs),
		).toBe(true);
	});

	it("缺一项", () => {
		expect(hasAllPermissions(["news:view"], newsDefs)).toBe(false);
	});

	it("多个分组通配符覆盖跨组全部", () => {
		expect(hasAllPermissions(["news:*", "admin:*"], crossDefs)).toBe(true);
	});

	it("空 required 数组始终为 true", () => {
		expect(hasAllPermissions([], [])).toBe(true);
		expect(hasAllPermissions(["**"], [])).toBe(true);
	});
});
