/**
 * SFn 调用 hook
 * 提供统一的 SFn 调用入口，内部调用 safeSfnCall 自动处理错误提示
 */
import { safeSfnCall } from "#/components/admin/sfn-helpers";

/** SFn 调用参数类型 */
interface SfnParams {
	data: unknown;
}

/** SFn 函数类型 */
type Sfn<T> = (params: SfnParams) => Promise<T>;

/**
 * SFn 调用 hook，thin wrapper of safeSfnCall
 * @example
 * const { call } = useSfnCall();
 * const result = await call(someSFn, { data: params }, "加载失败");
 */
export function useSfnCall() {
	async function call<T>(
		fn: Sfn<T>,
		params: SfnParams,
		fallbackMsg?: string,
	): Promise<T> {
		return safeSfnCall(fn(params), fallbackMsg);
	}

	return { call };
}
