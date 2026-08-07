/**
 * 主题注册表：管理端与前台主题的单一事实来源
 * 主题由「家族（配色） × 明暗（scheme）」组合而成，data-theme 属性承载完整主题名。
 * 新增一个主题家族只需两步：① 在对应 global.css 增加
 * `[data-theme="<family>-<scheme>"]` 变量块（或对既有家族的差异覆盖）；
 * ② 在本文件对应 ThemeSide.families 注册条目（主题切换 UI 即自动出现）。
 * 注意：antd 的 colorPrimary 需要真实色值，必须与 CSS 中对应 `--s-primary` 保持同色。
 * Document.tsx 内联 init 脚本内的家族映射也需同步（脚本为纯 JS 字符串无法 import）。
 */
import type { ThemeSide } from "@fsdx/ui-ssr/use-theme-mode";

/** 管理端主题侧：棕色（默认）/ 蓝灰 / 绿色 三个家族 */
export const ADMIN_SIDE: ThemeSide = {
	storageKeyMode: "admin-theme",
	storageKeyFamily: "admin-theme-family",
	defaultFamilyId: "brown",
	families: [
		{
			id: "brown",
			label: "棕色",
			light: {
				dataTheme: "admin-brown-light",
				isDark: false,
				// 与 admin.global.css 亮色 --s-primary（--t-brand-brown-500）同色
				antdColorPrimary: "#795548",
			},
			dark: {
				dataTheme: "admin-brown-dark",
				isDark: true,
				// 与 admin.global.css 暗色 --s-primary（--t-brand-brown-300）同色
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
		{
			id: "green",
			label: "绿色",
			light: {
				dataTheme: "admin-green-light",
				isDark: false,
				antdColorPrimary: "#00b96b",
			},
			dark: {
				dataTheme: "admin-green-dark",
				isDark: true,
				antdColorPrimary: "#26d57c",
			},
		},
	],
};

/** 前台主题侧：中性灰单家族 */
export const CLIENT_SIDE: ThemeSide = {
	storageKeyMode: "client-theme",
	storageKeyFamily: "client-theme-family",
	defaultFamilyId: "neutral",
	families: [
		{
			id: "neutral",
			label: "中性灰",
			light: {
				dataTheme: "client-neutral-light",
				isDark: false,
				// 前台为「文字即主色」的中性风格，主色取中性深色
				antdColorPrimary: "#212121",
			},
			dark: {
				dataTheme: "client-neutral-dark",
				isDark: true,
				antdColorPrimary: "#f5f5f5",
			},
		},
	],
};

/**
 * 生成 Document 内联 init 脚本所需的家族映射 JSON（家族 id → 主题前缀）。
 * 主题前缀约定为 dataTheme 去掉 `-light`/`-dark` 后缀（如 admin-brown-light → admin-brown）。
 * init 脚本据此从 storage 读取家族 id 拼出完整 dataTheme，避免脚本与注册表手工双写漂移。
 */
export function buildFamilyMapJson(side: ThemeSide): string {
	const map: Record<string, string> = {};
	for (const family of side.families) {
		map[family.id] = family.light.dataTheme.replace(/(?:-light|-dark)$/, "");
	}
	return JSON.stringify(map);
}
