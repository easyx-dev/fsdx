/**
 * SFn 错误处理示例的路由局部 schema（供参数校验失败演示使用）
 */
import { z } from "zod";

/** 参数校验示例：count 必须为正整数 */
export const demoValidationSchema = z.object({
	count: z.number().int().min(1, "数量至少为 1"),
});
