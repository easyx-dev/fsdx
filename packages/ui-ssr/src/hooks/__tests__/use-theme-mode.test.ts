/**
 * useThemeMode hook 测试：明暗模式与家族初始化、切换、持久化、data-theme 应用
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ThemeSide } from "../use-theme-mode";
import { useThemeMode } from "../use-theme-mode";

/** 测试用主题侧：棕 / 蓝灰 两个家族 */
const TEST_SIDE: ThemeSide = {
	storageKeyMode: "test-theme",
	storageKeyFamily: "test-theme-family",
	defaultFamilyId: "brown",
	families: [
		{
			id: "brown",
			label: "棕色",
			light: {
				dataTheme: "admin-brown-light",
				isDark: false,
				antdColorPrimary: "#795548",
			},
			dark: {
				dataTheme: "admin-brown-dark",
				isDark: true,
				antdColorPrimary: "#a1887f",
			},
		},
		{
			id: "bluegrey",
			label: "蓝灰",
			light: {
				dataTheme: "admin-bluegrey-light",
				isDark: false,
				antdColorPrimary: "#607d8b",
			},
			dark: {
				dataTheme: "admin-bluegrey-dark",
				isDark: true,
				antdColorPrimary: "#90a4ae",
			},
		},
	],
};

function setupDom() {
	vi.spyOn(document.documentElement, "setAttribute").mockImplementation(
		() => {},
	);
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
		setupDom();
		setupMatchMedia();
	});

	it("默认 mode 为 auto、familyId 为默认家族", () => {
		const { result } = renderHook(() => useThemeMode(TEST_SIDE));
		expect(result.current.mode).toBe("auto");
		expect(result.current.familyId).toBe("brown");
		expect(result.current.isDark).toBe(false);
	});

	it("从 localStorage 读取保存的明暗模式", () => {
		localStorage.setItem("test-theme", "dark");
		const { result } = renderHook(() => useThemeMode(TEST_SIDE));
		expect(result.current.mode).toBe("dark");
		expect(result.current.isDark).toBe(true);
	});

	it("从 localStorage 读取保存的家族，非法值回退默认家族", () => {
		localStorage.setItem("test-theme-family", "bluegrey");
		const { result } = renderHook(() => useThemeMode(TEST_SIDE));
		expect(result.current.familyId).toBe("bluegrey");

		localStorage.setItem("test-theme-family", "unknown");
		const { result: result2 } = renderHook(() => useThemeMode(TEST_SIDE));
		expect(result2.current.familyId).toBe("brown");
	});

	it("setMode 切换为 dark 并持久化，data-theme 应用暗色主题名", () => {
		const { result } = renderHook(() => useThemeMode(TEST_SIDE));

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
		const { result } = renderHook(() => useThemeMode(TEST_SIDE));

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

	it("setFamilyId 切换家族并持久化，data-theme 随家族变化", () => {
		const { result } = renderHook(() => useThemeMode(TEST_SIDE));

		act(() => {
			result.current.setFamilyId("bluegrey");
		});

		expect(result.current.familyId).toBe("bluegrey");
		expect(localStorage.getItem("test-theme-family")).toBe("bluegrey");
		expect(document.documentElement.setAttribute).toHaveBeenCalledWith(
			"data-theme",
			"admin-bluegrey-light",
		);
	});

	it("mode 为 dark 时 scheme 指向暗色方案", () => {
		localStorage.setItem("test-theme", "dark");
		const { result } = renderHook(() => useThemeMode(TEST_SIDE));
		expect(result.current.scheme.dataTheme).toBe("admin-brown-dark");
		expect(result.current.scheme.antdColorPrimary).toBe("#a1887f");
	});
});
