/**
 * useThemeMode hook 测试：明暗模式初始化、切换、持久化、data-theme 应用
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ThemePreset } from "../use-theme-mode";
import { useThemeMode } from "../use-theme-mode";

/** 测试用主题预设 */
const TEST_PRESET: ThemePreset = {
	storageKey: "test-theme",
	light: {
		dataTheme: "admin-brown-light",
		isDark: false,
		antdColorPrimary: "#795548",
		themeColor: "#ffffff",
	},
	dark: {
		dataTheme: "admin-brown-dark",
		isDark: true,
		antdColorPrimary: "#a1887f",
		themeColor: "#0a0a0a",
	},
};

function setupDom() {
	vi.spyOn(document.documentElement, "setAttribute").mockImplementation(
		() => {},
	);
}

/** 预插入 `<meta name="theme-color">` 节点，供主题色跟随断言使用 */
function setupThemeColorMeta() {
	const meta = document.createElement("meta");
	meta.name = "theme-color";
	meta.content = "";
	document.head.appendChild(meta);
}

function setupMatchMedia(matches = false) {
	Object.defineProperty(window, "matchMedia", {
		writable: true,
		value: vi.fn().mockImplementation(() => ({
			matches,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		})),
	});
}

describe("useThemeMode", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
		document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
			meta.remove();
		});
		setupDom();
		setupMatchMedia();
	});

	it("默认 mode 为 auto、isDark 为 false", () => {
		const { result } = renderHook(() => useThemeMode(TEST_PRESET));
		expect(result.current.mode).toBe("auto");
		expect(result.current.isDark).toBe(false);
	});

	it("从 localStorage 读取保存的明暗模式", () => {
		localStorage.setItem("test-theme", "dark");
		const { result } = renderHook(() => useThemeMode(TEST_PRESET));
		expect(result.current.mode).toBe("dark");
		expect(result.current.isDark).toBe(true);
	});

	it("setMode 切换为 dark 并持久化，data-theme 应用暗色主题名", () => {
		const { result } = renderHook(() => useThemeMode(TEST_PRESET));

		act(() => {
			result.current.setMode("dark");
		});

		expect(result.current.mode).toBe("dark");
		expect(localStorage.getItem("test-theme")).toBe("dark");
		expect(document.documentElement.setAttribute).toHaveBeenCalledWith(
			"data-theme",
			"admin-brown-dark",
		);
	});

	it("setMode 切换为 light 并持久化", () => {
		const { result } = renderHook(() => useThemeMode(TEST_PRESET));

		act(() => {
			result.current.setMode("light");
		});

		expect(result.current.mode).toBe("light");
		expect(localStorage.getItem("test-theme")).toBe("light");
		expect(document.documentElement.setAttribute).toHaveBeenCalledWith(
			"data-theme",
			"admin-brown-light",
		);
	});

	it("mode 为 dark 时 scheme 指向暗色方案", () => {
		localStorage.setItem("test-theme", "dark");
		const { result } = renderHook(() => useThemeMode(TEST_PRESET));
		expect(result.current.scheme.dataTheme).toBe("admin-brown-dark");
		expect(result.current.scheme.antdColorPrimary).toBe("#a1887f");
	});

	it("切换主题时同步 meta theme-color", () => {
		setupThemeColorMeta();
		const meta = document.querySelector('meta[name="theme-color"]')!;
		const { result } = renderHook(() => useThemeMode(TEST_PRESET));

		act(() => {
			result.current.setMode("dark");
		});
		expect(meta.getAttribute("content")).toBe("#0a0a0a");

		act(() => {
			result.current.setMode("light");
		});
		expect(meta.getAttribute("content")).toBe("#ffffff");
	});

	it("无 meta theme-color 节点时不抛错", () => {
		const { result } = renderHook(() => useThemeMode(TEST_PRESET));
		act(() => {
			result.current.setMode("dark");
		});
		expect(result.current.mode).toBe("dark");
	});
});
