/**
 * 日志 Schema 验证测试
 */
import { describe, expect, it } from "vitest";
import { searchLogsSchema } from "../logs.functions";

describe("searchLogsSchema", () => {
	it("空参数应通过校验", () => {
		const result = searchLogsSchema.safeParse({});
		expect(result.success).toBe(true);
	});

	it("所有参数同时传入应通过校验", () => {
		const result = searchLogsSchema.safeParse({
			startDate: "2024-01-01",
			endDate: "2024-12-31",
			keyword: "error",
			level: "error",
			page: 1,
			pageSize: 20,
		});
		expect(result.success).toBe(true);
	});
});
