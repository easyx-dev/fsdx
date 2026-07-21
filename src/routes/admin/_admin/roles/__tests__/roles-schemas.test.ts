/**
 * 角色管理 Schema 验证测试
 */
import { describe, expect, it } from "vitest";
import {
	idSchema,
	roleCreateSchema,
	roleListSchema,
	roleUpdateSchema,
} from "../roles.schemas";

describe("roleListSchema", () => {
	it("空参数通过", () => {
		expect(roleListSchema.safeParse({}).success).toBe(true);
	});

	it("带 keyword 通过", () => {
		expect(roleListSchema.safeParse({ keyword: "admin" }).success).toBe(true);
	});
});

describe("roleCreateSchema", () => {
	it("合法输入通过，permissions 默认空数组", () => {
		const result = roleCreateSchema.safeParse({
			name: "编辑者",
			slug: "editor",
			permissions: ["news:read", "news:create"],
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.permissions).toEqual(["news:read", "news:create"]);
		}

		const defaultResult = roleCreateSchema.safeParse({
			name: "查看者",
			slug: "viewer",
		});
		expect(defaultResult.success).toBe(true);
		if (defaultResult.success) {
			expect(defaultResult.data.permissions).toEqual([]);
		}
	});

	it("空 name 失败", () => {
		expect(roleCreateSchema.safeParse({ name: "", slug: "e" }).success).toBe(
			false,
		);
	});
});

describe("roleUpdateSchema", () => {
	it("部分字段更新通过", () => {
		expect(
			roleUpdateSchema.safeParse({
				id: "r-1",
				permissions: ["news:read"],
			}).success,
		).toBe(true);
	});

	it("slug 不可为空字符串", () => {
		expect(roleUpdateSchema.safeParse({ id: "r-1", slug: "" }).success).toBe(
			false,
		);
	});

	it("缺少 id 失败", () => {
		expect(roleUpdateSchema.safeParse({ name: "x" }).success).toBe(false);
	});
});

describe("idSchema", () => {
	it("有效 id 通过", () => {
		expect(idSchema.safeParse({ id: "r-1" }).success).toBe(true);
	});

	it("空 id 失败", () => {
		expect(idSchema.safeParse({ id: "" }).success).toBe(false);
	});
});
