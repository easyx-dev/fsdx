/**
 * 跨 bundle（Nitro 入口 / SSR 渲染器）共享的依赖注入存储
 *
 * 背景：bootstrap 在 Nitro 入口调用 initXxx 注入依赖，而 TanStack Start SSR 渲染器
 * 会单独打包一份 core 模块实例，模块级单例在两侧分裂 → SSR 侧读不到已注入的依赖。
 * 与 metrics 同模式：注入状态挂载于 globalThis，任意 bundle 读写同一份。
 *
 * 用法：各 infra 模块用模块私有 key 创建 store，仅经 store 封装（get/set/reset）访问，
 * 避免各模块重复手写 globalThis 存取样板。
 */
export interface GlobalDepsStore<T> {
	/** 读取当前注入的依赖，未注入返回 null */
	get(): T | null;
	/** 写入依赖（bootstrap 启动时调用） */
	set(deps: T): void;
	/** 重置为未注入（测试专用） */
	reset(): void;
}

/**
 * 创建挂载于 globalThis 的依赖存储
 * @param key 全局唯一键（如 "__FSDX_AI_DEPS__"），不同模块必须不冲突
 */
export function createGlobalDepsStore<T>(key: string): GlobalDepsStore<T> {
	const box = (): { deps: T | null } => {
		const global = globalThis as typeof globalThis & {
			[key: string]: { deps: T | null } | undefined;
		};
		global[key] ??= { deps: null };
		return global[key]!;
	};

	return {
		get: () => box().deps,
		set: (deps) => {
			box().deps = deps;
		},
		reset: () => {
			box().deps = null;
		},
	};
}
