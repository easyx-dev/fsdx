/**
 * 文件管理 Schema 验证测试
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { idSchema } from "../files.functions";

const fileListSchema = z.object({
	status: z.string().optional(),
	keyword: z.string().optional(),
	sortField: z.string().optional(),
	sortOrder: z.enum(["ascend", "descend"]).optional(),
	page: z.number().optional(),
	pageSize: z.number().optional(),
});

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
});
