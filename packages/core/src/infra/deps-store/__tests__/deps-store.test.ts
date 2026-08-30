/**
 * 跨 bundle 依赖存储测试：get/set/reset 与同 key 跨实例共享
 */
import { describe, expect, it } from "vitest";
import { createGlobalDepsStore } from "../index";

interface FakeDeps {
	key: string;
	value: number;
}

describe("createGlobalDepsStore", () => {
	it("未注入时 get 返回 null", () => {
		const store = createGlobalDepsStore<FakeDeps>("__TEST_DEPS_UNSET__");
		expect(store.get()).toBeNull();
	});

	it("set 后 get 返回同一实例引用", () => {
		const store = createGlobalDepsStore<FakeDeps>("__TEST_DEPS_VALUE__");
		const deps = { key: "a", value: 1 };
		store.set(deps);
		expect(store.get()).toBe(deps);
	});

	it("reset 清空注入状态", () => {
		const store = createGlobalDepsStore<FakeDeps>("__TEST_DEPS_RESET__");
		store.set({ key: "a", value: 1 });
		store.reset();
		expect(store.get()).toBeNull();
	});

	it("同 key 创建的多个 store 共享同一份存储（模拟跨 bundle）", () => {
		const key = "__TEST_DEPS_SHARED__";
		const depA = { key: "a", value: 1 };
		createGlobalDepsStore<FakeDeps>(key).set(depA);
		// 第二个"bundle"实例读取同一 key
		const storeB = createGlobalDepsStore<FakeDeps>(key);
		expect(storeB.get()).toBe(depA);
	});

	it("不同 key 互不干扰", () => {
		const storeA = createGlobalDepsStore<FakeDeps>("__TEST_DEPS_ISO_A__");
		const storeB = createGlobalDepsStore<FakeDeps>("__TEST_DEPS_ISO_B__");
		storeA.set({ key: "a", value: 1 });
		expect(storeB.get()).toBeNull();
	});
});
