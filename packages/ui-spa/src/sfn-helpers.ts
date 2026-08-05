/**
 * SFn 调用辅助：统一错误提示 + 错误解包
 * 管理端组件层调用 SFn 的统一入口，自动用 antd message 提示错误
 */
import { message } from "./antd-static";

/** 获取错误信息 */
function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message || "未知错误";
	}

	if (
		error &&
		typeof error === "object" &&
		"message" in error &&
		typeof error.message === "string"
	) {
		return error.message;
	}

	return String(error || "未知错误");
}

/** 显示错误信息 */
function showError(error: unknown, fallbackMsg?: string) {
	const msg = getErrorMessage(error);
	message.error(fallbackMsg ? `${fallbackMsg}：${msg}` : msg);
}

/**
 * 安全调用 SFn
 * 自动提示错误，并继续抛出异常
 */
export async function safeSfnCall<T>(
	promise: PromiseLike<T>,
	fallbackMsg?: string,
): Promise<T> {
	try {
		return await promise;
	} catch (error) {
		showError(error, fallbackMsg);
		throw error;
	}
}

/**
 * 解包 Promise
 *
 * 返回：
 *   成功：[data, null]
 *   失败：[null, error]
 */
export async function unwrapSfn<T>(
	promise: PromiseLike<T>,
	fallbackMsg?: string,
): Promise<readonly [T, null] | readonly [null, unknown]> {
	try {
		return [await promise, null] as const;
	} catch (error) {
		showError(error, fallbackMsg);
		return [null, error] as const;
	}
}
