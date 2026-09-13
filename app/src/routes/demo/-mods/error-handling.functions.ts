/**
 * SFn 错误处理示例 Server Function（前台）：构造不同错误分类，演示客户端统一错误提示
 */
import { createServerFn } from "@tanstack/react-start";
import { ClientAuthError } from "#/middleware/client-auth";
import { clientDemoValidationSchema } from "./error-handling.schemas";

/** 业务错误：中文文案，客户端按 business 分类提示原文 */
export const clientDemoBusinessErrorSFn = createServerFn({
	method: "POST",
}).handler(async () => {
	throw new Error("示例业务错误：库存不足，无法下单");
});

/** 参数校验失败：validator 抛错，客户端提示「参数校验失败：数量至少为 1」 */
export const clientDemoValidationErrorSFn = createServerFn({ method: "POST" })
	.validator(clientDemoValidationSchema)
	.handler(async ({ data }) => ({ count: data.count }));

/** 系统错误：英文技术错误，生产环境兜底并追加请求号 */
export const clientDemoInternalErrorSFn = createServerFn({
	method: "POST",
}).handler(async () => {
	throw new Error("demo internal failure: connection reset by peer");
});

/** 鉴权失败：显式抛 ClientAuthError，客户端按 auth 分类提示（不带请求号） */
export const clientDemoAuthErrorSFn = createServerFn({
	method: "POST",
}).handler(async () => {
	throw new ClientAuthError("请先登录（示例）：当前请求缺少有效登录态", 401);
});

/** 正常返回：成功对照 */
export const clientDemoSuccessSFn = createServerFn({ method: "POST" }).handler(
	async () => ({ ok: true, at: new Date().toISOString() }),
);
