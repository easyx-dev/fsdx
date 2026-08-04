/**
 * 管理员用户 Schema 验证测试
 */
import { describe, expect, it } from "vitest";
import {
	createSchema,
	idSchema,
	listSchema,
	resetPwdSchema,
	updateSchema,
} from "../admins.schemas";

describe("listSchema", () => {
	it("空参数通过", () => {
		expect(listSchema.safeParse({}).success).toBe(true);
	});

	it("全部参数通过", () => {
		expect(
			listSchema.safeParse({
				page: 1,
				pageSize: 10,
				keyword: "admin",
				sortField: "createdAt",
				sortOrder: "descend",
			}).success,
		).toBe(true);
	});
});

describe("createSchema", () => {
	it("合法输入通过", () => {
		expect(
			createSchema.safeParse({
				username: "admin",
				email: "admin@example.com",
				password: "123456",
				adminRoleId: "r-1",
			}).success,
		).toBe(true);
	});

	it("缺少 adminRoleId 失败", () => {
		expect(
			createSchema.safeParse({
				username: "admin",
				email: "admin@example.com",
				password: "123456",
			}).success,
		).toBe(false);
	});

	it("非法邮箱格式失败", () => {
		expect(
			createSchema.safeParse({
				username: "admin",
				email: "bad",
				password: "123456",
				adminRoleId: "r-1",
			}).success,
		).toBe(false);
	});
});

describe("updateSchema", () => {
	it("部分字段更新通过（仅 status）", () => {
		expect(
			updateSchema.safeParse({
				id: "u-1",
				status: "disabled",
			}).success,
		).toBe(true);
	});

	it("缺少 id 失败", () => {
		expect(updateSchema.safeParse({ username: "x" }).success).toBe(false);
	});
});

describe("idSchema", () => {
	it("有效 id 通过", () => {
		expect(idSchema.safeParse({ id: "u-1" }).success).toBe(true);
	});

	it("空 id 失败", () => {
		expect(idSchema.safeParse({ id: "" }).success).toBe(false);
	});
});

describe("resetPwdSchema", () => {
	it("合法输入通过", () => {
		expect(
			resetPwdSchema.safeParse({ id: "u-1", password: "newpwd1" }).success,
		).toBe(true);
	});

	it("密码不足 6 位失败", () => {
		expect(
			resetPwdSchema.safeParse({ id: "u-1", password: "12345" }).success,
		).toBe(false);
	});

	it("缺少 id 失败", () => {
		expect(resetPwdSchema.safeParse({ password: "123456" }).success).toBe(
			false,
		);
	});
});
