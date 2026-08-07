/**
 * 统一主题模式管理 hook
 * 基于 useSyncExternalStore 将 localStorage 中的主题模式/家族作为共享外部状态，
 * 保证同一 storageKey 的多个调用点（ThemeToggle / AdminLayout）实时同步，
 * 并支持跨标签页与操作系统主题变化联动。
 * 主题由「家族（配色） × 明暗」组合为具名主题，data-theme 承载完整主题名
 * （家族与 storageKey 配置见 app 的 theme/themes.ts 注册表）。
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";

/** 具名主题方案：dataTheme 须与对应 global.css 主题块选择器一致 */
export interface ThemeScheme {
	/** data-theme 属性值，须与 CSS 主题块选择器一致 */
	dataTheme: string;
	isDark: boolean;
	/** antd ConfigProvider colorPrimary，须与 CSS `--s-primary` 同色 */
	antdColorPrimary: string;
}

/** 主题家族：一套配色（如棕色/蓝灰/绿色），含亮暗两档 */
export interface ThemeFamily {
	/** 家族标识，如 brown */
	id: string;
	/** 家族显示名 */
	label: string;
	light: ThemeScheme;
	dark: ThemeScheme;
}

/** 主题侧：一端（管理端/前台）的明暗模式 + 可选家族列表 */
export interface ThemeSide {
	/** localStorage 明暗模式键名 */
	storageKeyMode: string;
	/** localStorage 家族键名 */
	storageKeyFamily: string;
	/** 默认家族 id */
	defaultFamilyId: string;
	families: ThemeFamily[];
}

/** 主题明暗模式 */
export type ThemeMode = "light" | "dark" | "auto";

const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

/** 从 localStorage 读取保存的主题明暗模式 */
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

/** 从 localStorage 读取保存的主题家族 id（非法值回退默认家族） */
function getStoredFamilyId(side: ThemeSide): string {
	try {
		const stored = localStorage.getItem(side.storageKeyFamily);
		if (side.families.some((f) => f.id === stored)) return stored as string;
	} catch {
		/* SSR 环境忽略 */
	}
	return side.defaultFamilyId;
}

/** 模块级监听器集合：同一页面内所有 hook 实例共享，setMode/setFamilyId 时统一通知 */
const listeners = new Set<() => void>();

function notifyThemeChange() {
	for (const listener of listeners) listener();
}

/**
 * 订阅主题变化：同页实例通知 + storage 事件（跨标签页）。
 * storage 回调仅关注本侧主题键，避免同源其他键的写入触发无关重渲染。
 */
function subscribeTheme(side: ThemeSide, callback: () => void) {
	listeners.add(callback);
	const onStorage = (event: StorageEvent) => {
		if (
			event.key === null ||
			event.key === side.storageKeyMode ||
			event.key === side.storageKeyFamily
		) {
			callback();
		}
	};
	window.addEventListener("storage", onStorage);
	return () => {
		listeners.delete(callback);
		window.removeEventListener("storage", onStorage);
	};
}

/** 订阅操作系统暗色偏好变化（auto 模式下需要联动） */
function subscribeMedia(callback: () => void) {
	const mq = window.matchMedia(DARK_MEDIA_QUERY);
	mq.addEventListener("change", callback);
	return () => mq.removeEventListener("change", callback);
}

function getMediaSnapshot() {
	return window.matchMedia(DARK_MEDIA_QUERY).matches;
}

/** 按 id 解析家族：未知 id 回退默认家族 */
function resolveFamily(side: ThemeSide, familyId: string): ThemeFamily {
	return (
		side.families.find((f) => f.id === familyId) ??
		side.families.find((f) => f.id === side.defaultFamilyId) ??
		side.families[0]
	);
}

/**
 * 应用主题到 DOM：两端统一使用 data-theme 属性（值为完整主题名，见主题注册表）。
 * 主题名由 themes.ts 注册表与 global.css 主题块共同约定，变更需两处同步。
 */
function applyThemeToDom(
	mode: ThemeMode,
	family: ThemeFamily,
	prefersDark: boolean,
) {
	const resolvedDark = mode === "auto" ? prefersDark : mode === "dark";
	const scheme = resolvedDark ? family.dark : family.light;
	document.documentElement.setAttribute("data-theme", scheme.dataTheme);
	document.documentElement.style.colorScheme = resolvedDark ? "dark" : "light";
}

/**
 * 统一主题模式 hook
 * @param side 主题侧配置（storageKey / 家族列表，见 app 的 theme/themes.ts）
 * @returns mode 明暗三态、familyId 当前家族、scheme 当前主题方案（含 dataTheme 与 antd 主色）
 */
export function useThemeMode(side: ThemeSide) {
	const mode = useSyncExternalStore(
		(cb) => subscribeTheme(side, cb),
		() => getStoredMode(side.storageKeyMode),
		() => "auto" as ThemeMode,
	);
	const familyId = useSyncExternalStore(
		(cb) => subscribeTheme(side, cb),
		() => getStoredFamilyId(side),
		() => side.defaultFamilyId,
	);
	const prefersDark = useSyncExternalStore(
		subscribeMedia,
		getMediaSnapshot,
		() => false,
	);

	const family = resolveFamily(side, familyId);

	const setMode = useCallback(
		(newMode: ThemeMode) => {
			try {
				localStorage.setItem(side.storageKeyMode, newMode);
			} catch {
				/* ignore */
			}
			notifyThemeChange();
		},
		[side.storageKeyMode],
	);

	const setFamilyId = useCallback(
		(newFamilyId: string) => {
			try {
				localStorage.setItem(side.storageKeyFamily, newFamilyId);
			} catch {
				/* ignore */
			}
			notifyThemeChange();
		},
		[side.storageKeyFamily],
	);

	// 同步主题到 DOM：多实例应用同一值是幂等操作。
	// 直接读取 localStorage/媒体查询的最新值应用，而非使用 effect 闭包里的快照——
	// SSR 前台水合期间 useSyncExternalStore 首帧返回服务端默认值，若用默认值应用会
	// 短暂覆盖 Document init 脚本已设置好的首帧主题（管理端包在 ClientOnly 内不受影响）。
	useEffect(() => {
		applyThemeToDom(
			getStoredMode(side.storageKeyMode),
			resolveFamily(side, getStoredFamilyId(side)),
			window.matchMedia(DARK_MEDIA_QUERY).matches,
		);
	}, [mode, familyId, prefersDark, side]);

	const isDark = mode === "auto" ? prefersDark : mode === "dark";
	const scheme: ThemeScheme = isDark ? family.dark : family.light;

	return { mode, setMode, familyId, setFamilyId, isDark, scheme, family };
}
