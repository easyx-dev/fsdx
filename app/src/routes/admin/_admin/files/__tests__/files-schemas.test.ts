/**
 * 文件管理 Schema 验证测试
 */
import { describe, expect, it } from "vitest";
import { fileListSchema } from "#/services/file/file.functions";
import { idSchema } from "../-mods/files.functions";

describe("idSchema", () => {
	it("有效 id 通过", () => {
		expect(idSchema.safeParse({ id: "f-1" }).success).toBe(true);
	});

	it("空 id 失败", () => {
		expect(idSchema.safeParse({ id: "" }).success).toBe(false);
	});
});

describe("fileListSchema", () => {
	it("空参数通过", () => {
		expect(fileListSchema.safeParse({}).success).toBe(true);
	});

	it("带 status 参数通过", () => {
		expect(fileListSchema.safeParse({ status: "temp" }).success).toBe(true);
	});

	it("带 mimePrefix 参数通过", () => {
		expect(fileListSchema.safeParse({ mimePrefix: "image/" }).success).toBe(
			true,
		);
	});

	it("sortOrder 非法值失败", () => {
		expect(fileListSchema.safeParse({ sortOrder: "invalid" }).success).toBe(
			false,
		);
	});
});
