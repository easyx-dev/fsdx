/**
 * 操作日志 Schema 验证测试
 */
import { describe, expect, it } from "vitest";
import { searchOperationLogsSchema } from "../operation-logs.functions";

describe("searchOperationLogsSchema", () => {
	it("空参数应通过校验", () => {
		const result = searchOperationLogsSchema.safeParse({});
		expect(result.success).toBe(true);
	});

	it("所有参数同时传入应通过校验", () => {
		const result = searchOperationLogsSchema.safeParse({
			module: "news",
			action: "create",
			keyword: "admin",
			startDate: "2024-01-01",
			endDate: "2024-12-31",
			page: 1,
			pageSize: 20,
			sortField: "createdAt",
			sortOrder: "ascend",
		});
		expect(result.success).toBe(true);
	});
});
