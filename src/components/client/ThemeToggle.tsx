/**
 * 前台主题切换按钮
 */
import { useThemeMode } from "#/hooks/use-theme-mode";

export default function ThemeToggle() {
	const { mode, setMode } = useThemeMode("theme");

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
