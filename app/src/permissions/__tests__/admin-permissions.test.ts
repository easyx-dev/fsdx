/**
 * 权限匹配逻辑测试
 * 覆盖 matchPermission / hasAdminPermission / hasAnyAdminPermission / hasAllAdminPermissions
 * 及 ** 超级通配符、group:* 分组通配符、精确匹配三种模式
 */

import { describe, expect, it } from "vitest";
import {
	ADMIN_PERMISSIONS,
	hasAdminPermission,
	hasAllAdminPermissions,
	hasAnyAdminPermission,
} from "#/permissions/admin-permissions";

// ─── AdminPermissionDef 辅助工具 ───

/** 根据权限码从 ADMIN_PERMISSIONS 常量中查找对应的 AdminPermissionDef */
function findDef(code: string) {
	for (const def of Object.values(ADMIN_PERMISSIONS)) {
		if (def.code === code) return def;
	}
	throw new Error(`未找到权限定义: ${code}`);
}

// ═══════════════════════════════════════════════════════════════════
// hasAdminPermission — 检查单个权限
// ═══════════════════════════════════════════════════════════════════

describe("hasAdminPermission", () => {
	it("** 通配符命中", () => {
		expect(hasAdminPermission(["**"], findDef("news:view"))).toBe(true);
		expect(hasAdminPermission(["**"], findDef("admin:delete"))).toBe(true);
	});

	it("group:* 通配符命中", () => {
		expect(hasAdminPermission(["news:*"], findDef("news:view"))).toBe(true);
		expect(hasAdminPermission(["news:*"], findDef("news:publish"))).toBe(true);
	});

	it("精确匹配命中", () => {
		expect(
			hasAdminPermission(["news:view", "dict:edit"], findDef("news:view")),
		).toBe(true);
	});

	it("无权限", () => {
		expect(hasAdminPermission(["news:view"], findDef("admin:create"))).toBe(
			false,
		);
	});

	it("空权限数组", () => {
		expect(hasAdminPermission([], findDef("news:view"))).toBe(false);
	});

	it("含 ** 时忽略其他通配符", () => {
		expect(hasAdminPermission(["**"], ADMIN_PERMISSIONS.DASHBOARD_VIEW)).toBe(
			true,
		);
	});
});

// ═══════════════════════════════════════════════════════════════════
// hasAnyAdminPermission — 检查任一权限
// ═══════════════════════════════════════════════════════════════════

describe("hasAnyAdminPermission", () => {
	const newsDefs = [
		findDef("news:view"),
		findDef("news:create"),
		findDef("news:delete"),
	];

	it("** 命中任一", () => {
		expect(hasAnyAdminPermission(["**"], newsDefs)).toBe(true);
	});

	it("group:* 覆盖其中至少一项", () => {
		expect(hasAnyAdminPermission(["news:*"], newsDefs)).toBe(true);
	});

	it("至少一项精确命中", () => {
		expect(hasAnyAdminPermission(["news:view", "dict:edit"], newsDefs)).toBe(
			true,
		);
	});

	it("全部不命中", () => {
		expect(hasAnyAdminPermission(["admin:view", "dict:edit"], newsDefs)).toBe(
			false,
		);
	});

	it("空权限数组返回 false", () => {
		expect(hasAnyAdminPermission([], newsDefs)).toBe(false);
	});

	it("多个通配符同时存在", () => {
		const crossDefs = [findDef("news:view"), findDef("admin:create")];
		expect(hasAnyAdminPermission(["news:*"], crossDefs)).toBe(true);
		expect(hasAnyAdminPermission(["admin:*"], crossDefs)).toBe(true);
		expect(hasAnyAdminPermission(["dict:*"], crossDefs)).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════════════
// hasAllAdminPermissions — 检查全部权限
// ═══════════════════════════════════════════════════════════════════

describe("hasAllAdminPermissions", () => {
	const newsDefs = [findDef("news:view"), findDef("news:create")];
	const crossDefs = [findDef("news:view"), findDef("admin:create")];

	it("** 命中全部", () => {
		expect(hasAllAdminPermissions(["**"], newsDefs)).toBe(true);
		expect(hasAllAdminPermissions(["**"], crossDefs)).toBe(true);
	});

	it("group:* 覆盖全部同组权限", () => {
		expect(hasAllAdminPermissions(["news:*"], newsDefs)).toBe(true);
	});

	it("group:* 覆盖不完整（跨组要求）", () => {
		expect(hasAllAdminPermissions(["news:*"], crossDefs)).toBe(false);
	});

	it("全部精确命中", () => {
		expect(
			hasAllAdminPermissions(
				["news:view", "news:create", "dict:edit"],
				newsDefs,
			),
		).toBe(true);
	});

	it("缺一项", () => {
		expect(hasAllAdminPermissions(["news:view"], newsDefs)).toBe(false);
	});

	it("多个分组通配符覆盖跨组全部", () => {
		expect(hasAllAdminPermissions(["news:*", "admin:*"], crossDefs)).toBe(true);
	});

	it("空 required 数组始终为 true", () => {
		expect(hasAllAdminPermissions([], [])).toBe(true);
		expect(hasAllAdminPermissions(["**"], [])).toBe(true);
	});
});
