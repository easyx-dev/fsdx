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
	PERMISSIONS,
} from "#/constants/permissions/permissions";

// ─── PermissionDef 辅助工具 ───

/** 根据权限码从 PERMISSIONS 常量中查找对应的 PermissionDef */
function findDef(code: string) {
	for (const def of Object.values(PERMISSIONS)) {
		if (def.code === code) return def;
	}
	throw new Error(`未找到权限定义: ${code}`);
}

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
