/** @vitest-environment jsdom */
/**
 * GlobalStore 测试：GlobalStoreProvider 渲染 + useGlobalStore 上下文取值
 */

import type { Locale, Translations } from "@fsdx/core/i18n-types";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
	GlobalStoreProvider,
	globalStoreContext,
	useGlobalStore,
} from "#/components/providers";

afterEach(cleanup);

// ═══════════════════════════════════════════════════════════════════
// 测试辅助组件
// ═══════════════════════════════════════════════════════════════════

/**
 * 渲染 GlobalStoreProvider 并显示 locale 和指定 key 的翻译
 */
function TestComponent({ testKey }: { testKey: string }) {
	const { locale, translations, systemConfig } = useGlobalStore();
	return (
		<div>
			<span data-testid="locale">{locale}</span>
			<span data-testid="translation">
				{translations[testKey] ?? "MISSING"}
			</span>
			<span data-testid="config-site-name">
				{systemConfig?.site_name ?? "NO_CONFIG"}
			</span>
		</div>
	);
}

function renderWithGlobalStore(
	locale: Locale,
	translations: Translations,
	systemConfig: Record<string, string> = {},
	testKey = "首页",
) {
	return render(
		<GlobalStoreProvider value={{ locale, translations, systemConfig }}>
			<TestComponent testKey={testKey} />
		</GlobalStoreProvider>,
	);
}

// ═══════════════════════════════════════════════════════════════════
// GlobalStoreProvider
// ═══════════════════════════════════════════════════════════════════

describe("GlobalStoreProvider", () => {
	it("渲染子组件，locale 透传正确", () => {
		renderWithGlobalStore("zh", {});
		expect(screen.getByTestId("locale").textContent).toBe("zh");
	});

	it("locale 为 en 时子组件可获取正确语言", () => {
		renderWithGlobalStore("en", {});
		expect(screen.getByTestId("locale").textContent).toBe("en");
	});

	it("translations 透传到子组件", () => {
		renderWithGlobalStore("en", { 首页: "Home" });
		expect(screen.getByTestId("translation").textContent).toBe("Home");
	});

	it("缺失的翻译 key 返回 MISSING", () => {
		renderWithGlobalStore("en", {}, {}, "不存在的key");
		expect(screen.getByTestId("translation").textContent).toBe("MISSING");
	});

	it("中文 locale 下 translations 也正确透传", () => {
		renderWithGlobalStore("zh", { 首页: "Home" });
		expect(screen.getByTestId("locale").textContent).toBe("zh");
		expect(screen.getByTestId("translation").textContent).toBe("Home");
	});
});

// ═══════════════════════════════════════════════════════════════════
// useGlobalStore
// ═══════════════════════════════════════════════════════════════════

describe("useGlobalStore", () => {
	it("返回 locale 和 translations", () => {
		const translations: Translations = { 首页: "Home", 新闻: "News" };
		renderWithGlobalStore("en", translations);

		expect(screen.getByTestId("locale").textContent).toBe("en");
		expect(screen.getByTestId("translation").textContent).toBe("Home");
	});

	it("globalStoreContext 默认值可用（未包裹 Provider 时）", () => {
		// 直接使用 context 默认值渲染，验证不会崩溃
		const Consumer = () => {
			const { locale } = useGlobalStore();
			// locale 为 undefined（默认值 {} as GlobalStoreValue），渲染为空白
			return <span data-testid="default-locale">{locale ?? ""}</span>;
		};
		render(<Consumer />);
		expect(screen.getByTestId("default-locale").textContent).toBe("");
	});
});

// ═══════════════════════════════════════════════════════════════════
// globalStoreContext 导出验证
// ═══════════════════════════════════════════════════════════════════

describe("globalStoreContext", () => {
	it("是一个 React Context 对象", () => {
		expect(globalStoreContext).toBeDefined();
		expect(globalStoreContext.Provider).toBeDefined();
		expect(globalStoreContext.Consumer).toBeDefined();
	});
});

// ═══════════════════════════════════════════════════════════════════
// systemConfig 字段
// ═══════════════════════════════════════════════════════════════════

describe("useGlobalStore systemConfig", () => {
	it("透传 systemConfig 到子组件", () => {
		renderWithGlobalStore("zh", {}, { site_name: "我的站点" });
		expect(screen.getByTestId("config-site-name").textContent).toBe("我的站点");
	});

	it("空 systemConfig 时显示 NO_CONFIG", () => {
		renderWithGlobalStore("zh", {}, {});
		expect(screen.getByTestId("config-site-name").textContent).toBe(
			"NO_CONFIG",
		);
	});
});
