/**
 * 前台主题切换按钮：三态循环（亮/暗/跟随系统）
 * 需传入主题侧配置（家族与 storageKey，见 app 的 theme/themes.ts）
 */
import { type ThemeSide, useThemeMode } from "../hooks/use-theme-mode";

interface ThemeToggleProps {
	/** 主题侧配置（CLIENT_SIDE） */
	side: ThemeSide;
}

export default function ThemeToggle({ side }: ThemeToggleProps) {
	const { mode, setMode } = useThemeMode(side);

	function toggleMode() {
		const nextMode =
			mode === "light" ? "dark" : mode === "dark" ? "auto" : "light";
		setMode(nextMode);
	}

	const label =
		mode === "auto"
			? "Theme mode: auto (system). Click to switch to light mode."
			: `Theme mode: ${mode}. Click to switch mode.`;

	return (
		<button
			type="button"
			onClick={toggleMode}
			aria-label={label}
			title={label}
			className="rounded-full border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-accent"
		>
			{mode === "auto" ? "Auto" : mode === "dark" ? "Dark" : "Light"}
		</button>
	);
}
