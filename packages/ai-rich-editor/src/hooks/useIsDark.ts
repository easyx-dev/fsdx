/**
 * 主题暗色判定 hook：订阅 <html> 的 data-theme 属性变化，通过 -dark 后缀推导暗色
 * 不感知具体主题名，兼容管理端/前台双主题
 */
import { useEffect, useState } from "react";

/** 从 <html data-theme> 读取当前是否为暗色 */
function detectIsDark(): boolean {
	if (typeof document === "undefined") return false;
	return document.documentElement.dataset.theme?.endsWith("-dark") === true;
}

/**
 * 订阅宿主暗色主题，随 data-theme 变化实时联动
 * 依赖宿主将 data-theme 挂载在 <html>，值为「{端}-{亮暗}」组合（如 admin-dark）
 */
export function useIsDark(): boolean {
	const [isDark, setIsDark] = useState(detectIsDark);

	useEffect(() => {
		const el = document.documentElement;
		const update = () => setIsDark(detectIsDark());
		update();
		const observer = new MutationObserver(update);
		observer.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
		return () => observer.disconnect();
	}, []);

	return isDark;
}
