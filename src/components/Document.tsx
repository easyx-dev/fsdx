/**
 * 根路由：根据路径前缀分离 Admin（客户端渲染）与前台（SSR）
 */

import {
	ClientOnly,
	HeadContent,
	Scripts,
	useLocation,
} from "@tanstack/react-router";
import { App, theme as antdTheme, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	AdminLayout,
	AdminThemeContext,
	getStoredMode,
	resolveIsDark,
	type ThemeMode,
} from "#/components/admin/AdminLayout";
import Footer from "#/components/Footer";
import Header from "#/components/Header";
import adminGlobalCss from "#/styles/admin.global.css?url";
import ssrGlobalCss from "#/styles/ssr.global.css?url";
import { AuthProvider } from "./AuthProvider";

const THEME_INIT_SCRIPT = `(function(){try{var s=window.localStorage.getItem('theme');var m=(s==='light'||s==='dark'||s==='auto')?s:'auto';var d=m==='auto'?window.matchMedia('(prefers-color-scheme: dark)').matches:m==='dark';var r=document.documentElement;r.classList.remove('light','dark');r.classList.add(d?'dark':'light');if(m==='auto'){r.removeAttribute('data-theme')}else{r.setAttribute('data-theme',m)}r.style.colorScheme=d?'dark':'light'}catch(e){}})();`;

// 前台路由：SSR 渲染
export function SSRRootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="zh-CN" suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
				<link rel="stylesheet" href={ssrGlobalCss} />
				<title>SSR</title>
				<HeadContent />
			</head>
			<body className="font-sans antialiased flex min-h-screen flex-col">
				<Header />
				<div className="flex-1">{children}</div>
				<Footer />
				<Scripts />
			</body>
		</html>
	);
}

// Admin 路由：客户端渲染，集成主题管理与 antd ConfigProvider
export function AdminRootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="zh-CN" suppressHydrationWarning>
			<head>
				<title>FSDX Admin</title>
				<HeadContent />
				<link rel="stylesheet" href={adminGlobalCss} />
			</head>
			<body className="font-sans antialiased">
				<ClientOnly>
					<AdminProvider>{children}</AdminProvider>
				</ClientOnly>
				<Scripts />
			</body>
		</html>
	);
}

function AdminProvider({ children }: { children: React.ReactNode }) {
	const location = useLocation();
	const pathname = location.pathname;
	const isStandalone =
		pathname === "/admin/login" || pathname === "/admin/init";
	const isAdmin = pathname.startsWith("/admin");

	// 管理端主题状态
	const [mode, setMode] = useState<ThemeMode>("auto");
	// 水合完成标记 — 避免服务端/客户端首次渲染差异
	const [mounted, setMounted] = useState(false);

	// 初始化主题模式
	useEffect(() => {
		setMode(getStoredMode());
		setMounted(true);
	}, []);

	// 持久化主题模式
	const handleSetMode = useCallback((newMode: ThemeMode) => {
		setMode(newMode);
		try {
			localStorage.setItem("admin-theme", newMode);
		} catch {
			/* ignore */
		}
	}, []);

	// 监听系统主题变化（auto 模式时）
	useEffect(() => {
		if (mode !== "auto") return;
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const handler = () => setMode("auto"); // 触发 re-render 来更新 resolve 结果
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, [mode]);

	// 水合完成前统一返回 false（亮色），确保服务端/客户端首次渲染一致
	const isDark = useMemo(
		() => (mounted ? resolveIsDark(mode) : false),
		[mounted, mode],
	);

	const ctxValue = useMemo(
		() => ({ mode, setMode: handleSetMode, isDark }),
		[mode, handleSetMode, isDark],
	);

	// 同步 dark class 到 <html> 以启用 Tailwind dark: 变体
	useEffect(() => {
		const el = document.documentElement;
		el.classList.toggle("dark", isDark);
		el.style.colorScheme = isDark ? "dark" : "light";
	}, [isDark]);

	return (
		<AdminThemeContext.Provider value={ctxValue}>
			<ConfigProvider
				locale={zhCN}
				theme={{
					algorithm: isDark
						? antdTheme.darkAlgorithm
						: antdTheme.defaultAlgorithm,
				}}
			>
				<App>
					{!isStandalone && isAdmin ? (
						<AuthProvider>
							<AdminLayout>{children}</AdminLayout>
						</AuthProvider>
					) : (
						children
					)}
				</App>
			</ConfigProvider>
		</AdminThemeContext.Provider>
	);
}
