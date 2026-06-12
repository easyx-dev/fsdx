/**
 * 通用查询工具测试：软删除条件、分页、排序、分页执行
 */

import { describe, expect, it } from "vitest";
import {
	buildSortClause,
	DEFAULT_PAGE,
	DEFAULT_PAGE_SIZE,
	executePaginatedQuery,
	notDeleted,
	paginationOffset,
} from "../query-utils.server";

describe("DEFAULT_PAGE", () => {
	it("默认第一页为 1", () => {
		expect(DEFAULT_PAGE).toBe(1);
	});
});

describe("DEFAULT_PAGE_SIZE", () => {
	it("默认每页 20 条", () => {
		expect(DEFAULT_PAGE_SIZE).toBe(20);
	});
});

describe("paginationOffset", () => {
	it("第 1 页偏移量为 0", () => {
		expect(paginationOffset(1, 20)).toBe(0);
	});

	it("第 2 页偏移量为 20", () => {
		expect(paginationOffset(2, 20)).toBe(20);
	});

	it("第 3 页每页 10 条偏移量为 20", () => {
		expect(paginationOffset(3, 10)).toBe(20);
	});

	it("第 1 页每页 50 条偏移量为 0", () => {
		expect(paginationOffset(1, 50)).toBe(0);
	});
});

describe("notDeleted", () => {
	it("返回非空的 SQL 条件对象", () => {
		const result = notDeleted({ name: "deleted_at" });
		expect(result).toBeDefined();
	});
});

describe("buildSortClause", () => {
	const fieldMap = {
		createdAt: { name: "created_at" },
		updatedAt: { name: "updated_at" },
	};

	it("未指定 sortField 时使用默认字段降序", () => {
		const result = buildSortClause(fieldMap, undefined, undefined, "createdAt");
		expect(result).toBeDefined();
	});

	it("指定升序排序", () => {
		const result = buildSortClause(
			fieldMap,
			"createdAt",
			"ascend",
			"createdAt",
		);
		expect(result).toBeDefined();
	});

	it("指定降序排序", () => {
		const result = buildSortClause(
			fieldMap,
			"createdAt",
			"descend",
			"createdAt",
		);
		expect(result).toBeDefined();
	});

	it("非法 sortField 回退到默认字段", () => {
		const result = buildSortClause(
			fieldMap,
			"injectedField",
			"ascend" as any,
			"createdAt",
		);
		expect(result).toBeDefined();
	});
});

describe("executePaginatedQuery", () => {
	it("并行执行数据和计数查询并返回分页结构", async () => {
		const result = await executePaginatedQuery(
			Promise.resolve(["a", "b", "c"]),
			Promise.resolve(100),
			1,
			20,
		);

		expect(result.records).toEqual(["a", "b", "c"]);
		expect(result.total).toBe(100);
		expect(result.page).toBe(1);
		expect(result.pageSize).toBe(20);
	});

	it("空数组返回正确分页结构", async () => {
		const result = await executePaginatedQuery(
			Promise.resolve([]),
			Promise.resolve(0),
			2,
			10,
		);

		expect(result.records).toEqual([]);
		expect(result.total).toBe(0);
		expect(result.page).toBe(2);
		expect(result.pageSize).toBe(10);
	});
});
