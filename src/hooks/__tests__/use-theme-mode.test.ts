/**
 * useThemeMode hook 测试：模式初始化、切换、暗色模式解析
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useThemeMode } from "#/hooks/use-theme-mode";

function setupDom() {
	vi.spyOn(document.documentElement.classList, "add").mockImplementation(
		() => {},
	);
	vi.spyOn(document.documentElement.classList, "remove").mockImplementation(
		() => {},
	);
	vi.spyOn(document.documentElement, "setAttribute").mockImplementation(
		() => {},
	);
	vi.spyOn(document.documentElement, "removeAttribute").mockImplementation(
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

	it("初始化 mode 为 light（无 localStorage 时默认）", () => {
		const { result } = renderHook(() => useThemeMode("test-theme"));
		expect(result.current.mode).toBe("auto");
		expect(result.current.isDark).toBe(false);
	});

	it("从 localStorage 读取保存的模式", () => {
		localStorage.setItem("test-theme", "dark");
		const { result } = renderHook(() => useThemeMode("test-theme"));
		expect(result.current.mode).toBe("dark");
	});

	it("setMode 切换为 dark 并持久化", () => {
		const { result } = renderHook(() => useThemeMode("test-theme"));

		act(() => {
			result.current.setMode("dark");
		});

		expect(result.current.mode).toBe("dark");
		expect(localStorage.getItem("test-theme")).toBe("dark");
		expect(document.documentElement.classList.add).toHaveBeenCalledWith("dark");
	});

	it("setMode 切换为 light 并持久化", () => {
		const { result } = renderHook(() => useThemeMode("test-theme"));

		act(() => {
			result.current.setMode("light");
		});

		expect(result.current.mode).toBe("light");
		expect(localStorage.getItem("test-theme")).toBe("light");
	});

	it("mode 为 dark 时 isDark 为 true", () => {
		const { result } = renderHook(() => useThemeMode("test-theme"));

		act(() => {
			result.current.setMode("dark");
		});

		expect(result.current.isDark).toBe(true);
	});

	it("mode 为 light 时 isDark 为 false", () => {
		const { result } = renderHook(() => useThemeMode("test-theme"));

		act(() => {
			result.current.setMode("light");
		});

		expect(result.current.isDark).toBe(false);
	});
});
