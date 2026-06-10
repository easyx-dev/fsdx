/**
 * 统一主题模式管理 hook
 * 前台 ThemeToggle 与管理端 AdminLayout 共同使用，消除重复的主题切换逻辑
 */
import { useCallback, useEffect, useMemo, useState } from "react";

/** 主题模式 */
export type ThemeMode = "light" | "dark" | "auto";

/** 从 localStorage 读取保存的主题模式 */
function getStoredMode(key: string): ThemeMode {
	try {
		const stored = localStorage.getItem(key);
		if (stored === "light" || stored === "dark" || stored === "auto")
			return stored;
	} catch {
		/* SSR 环境忽略 */
	}
	return "auto";
}

/** 解析实际应用的暗色模式 */
function resolveIsDark(mode: ThemeMode): boolean {
	if (mode === "dark") return true;
	if (mode === "light") return false;
	if (typeof window !== "undefined") {
		return window.matchMedia("(prefers-color-scheme: dark)").matches;
	}
	return false;
}

/** 应用主题到 DOM：设置 classList、data-theme、colorScheme */
function applyThemeToDom(mode: ThemeMode) {
	const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
	const resolved = mode === "auto" ? (prefersDark ? "dark" : "light") : mode;

	document.documentElement.classList.remove("light", "dark");
	document.documentElement.classList.add(resolved);

	if (mode === "auto") {
		document.documentElement.removeAttribute("data-theme");
	} else {
		document.documentElement.setAttribute("data-theme", mode);
	}

	document.documentElement.style.colorScheme = resolved;
}

/**
 * 统一主题模式 hook
 * @param storageKey localStorage 键名，用于区分管理端和前台主题
 */
export function useThemeMode(storageKey: string) {
	const [mode, setModeState] = useState<ThemeMode>("auto");
	const [mounted, setMounted] = useState(false);

	// 初始化：从 localStorage 读取并应用
	useEffect(() => {
		const stored = getStoredMode(storageKey);
		setModeState(stored);
		applyThemeToDom(stored);
		setMounted(true);
	}, [storageKey]);

	// 持久化并切换模式
	const setMode = useCallback(
		(newMode: ThemeMode) => {
			setModeState(newMode);
			applyThemeToDom(newMode);
			try {
				localStorage.setItem(storageKey, newMode);
			} catch {
				/* ignore */
			}
		},
		[storageKey],
	);

	// 监听系统主题变化（auto 模式时）
	useEffect(() => {
		if (mode !== "auto") return;
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const handler = () => applyThemeToDom("auto");
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, [mode]);

	// 水合完成前返回 false 确保 SSR 一致性
	const isDark = useMemo(
		() => (mounted ? resolveIsDark(mode) : false),
		[mounted, mode],
	);

	return { mode, setMode, isDark };
}
