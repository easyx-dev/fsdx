/**
 * 主题注册表测试：默认家族、data-theme 唯一性、明暗方案完整性
 */
import { describe, expect, it } from "vitest";
import { ADMIN_SIDE, buildFamilyMapJson, CLIENT_SIDE } from "../themes";

describe("主题注册表", () => {
	it("管理端默认家族为棕色", () => {
		expect(ADMIN_SIDE.defaultFamilyId).toBe("brown");
		expect(ADMIN_SIDE.families[0]?.id).toBe("brown");
	});

	it("前台默认家族为中性灰", () => {
		expect(CLIENT_SIDE.defaultFamilyId).toBe("neutral");
		expect(CLIENT_SIDE.families).toHaveLength(1);
	});

	it("管理端提供棕/蓝灰/绿三套配色", () => {
		const ids = ADMIN_SIDE.families.map((f) => f.id);
		expect(ids).toEqual(["brown", "bluegrey", "green"]);
	});

	it("所有 dataTheme 全局唯一且明暗齐全", () => {
		const seen = new Set<string>();
		for (const side of [ADMIN_SIDE, CLIENT_SIDE]) {
			for (const family of side.families) {
				for (const scheme of [family.light, family.dark]) {
					expect(scheme.isDark).toBe(scheme === family.dark);
					expect(
						scheme.dataTheme.endsWith(scheme.isDark ? "-dark" : "-light"),
					).toBe(true);
					expect(seen.has(scheme.dataTheme)).toBe(false);
					seen.add(scheme.dataTheme);
				}
			}
		}
	});

	it("每个家族亮暗 antdColorPrimary 与 dataTheme 前缀一致", () => {
		for (const family of ADMIN_SIDE.families) {
			expect(family.light.dataTheme).toBe(`admin-${family.id}-light`);
			expect(family.dark.dataTheme).toBe(`admin-${family.id}-dark`);
			expect(family.light.antdColorPrimary).toBeTypeOf("string");
			expect(family.dark.antdColorPrimary).toBeTypeOf("string");
		}
	});

	it("buildFamilyMapJson 输出家族 id → 主题前缀，供 init 脚本拼接完整 dataTheme", () => {
		const adminMap = JSON.parse(buildFamilyMapJson(ADMIN_SIDE)) as Record<
			string,
			string
		>;
		expect(adminMap).toEqual({
			brown: "admin-brown",
			bluegrey: "admin-bluegrey",
			green: "admin-green",
		});

		const clientMap = JSON.parse(buildFamilyMapJson(CLIENT_SIDE)) as Record<
			string,
			string
		>;
		expect(clientMap).toEqual({ neutral: "client-neutral" });
	});
});
