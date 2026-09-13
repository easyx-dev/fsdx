/**
 * SFn 错误处理示例 schema 测试：参数校验边界
 */
import { describe, expect, it } from "vitest";
import { demoValidationSchema } from "../error-handling.schemas";

describe("demoValidationSchema", () => {
	it("正整数通过校验", () => {
		expect(demoValidationSchema.parse({ count: 1 })).toEqual({ count: 1 });
	});

	it("0 触发下限校验并返回中文文案", () => {
		const result = demoValidationSchema.safeParse({ count: 0 });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.message).toBe("数量至少为 1");
		}
	});

	it("非整数被拒绝", () => {
		expect(demoValidationSchema.safeParse({ count: 1.5 }).success).toBe(false);
	});

	it("非数字类型被拒绝", () => {
		expect(demoValidationSchema.safeParse({ count: "1" }).success).toBe(false);
	});
});
