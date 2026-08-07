/**
 * 根路由 Document 外壳：分离 Admin（客户端渲染）与前台（SSR + 国际化）
 */

import type { ThemePreset } from "@fsdx/ui-ssr/theme";
import { ClientOnly, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Toaster } from "sonner";
import { Footer, Header, useClientAuth } from "#/components/client";
import { useGlobalStore } from "#/components/providers";
import {
	setUserId,
	startRouteTracking,
	stopRouteTracking,
	init as trackInit,
} from "#/lib/track/track";
import adminGlobalCss from "#/styles/admin.global.css?url";
import ssrGlobalCss from "#/styles/ssr.global.css?inline";
import { ADMIN_THEME, CLIENT_THEME } from "#/theme/themes";
import { AdminProvider } from "./admin/AdminProvider";

// 内联层声明锁定级联层顺序：若全局 CSS <link> 加载失败（混合/陈旧部署 404），antd 运行时注入的
// @layer antd 会成为首层而落到 preflight 之下、全部样式被重置覆盖；声明顺序须与 global.css 顶部一致。
const LAYER_ORDER_STYLE =
	"@layer properties, theme, base, antd, components, utilities;";

/**
 * 生成主题 init 脚本：storageKey 与 dataTheme 均从 themes.ts 注册表推导，
 * 避免脚本与注册表手工双写导致首帧主题静默失效。
 */
function buildThemeInitScript(preset: ThemePreset): string {
	return `(function(){try{var m=localStorage.getItem('${preset.storageKey}')||'auto';m=(m==='light'||m==='dark'||m==='auto')?m:'auto';var d=m==='auto'?window.matchMedia('(prefers-color-scheme: dark)').matches:m==='dark';var r=document.documentElement;r.setAttribute('data-theme',d?'${preset.dark.dataTheme}':'${preset.light.dataTheme}');r.style.colorScheme=d?'dark':'light'}catch(e){}})();`;
}

const ADMIN_THEME_INIT_SCRIPT = buildThemeInitScript(ADMIN_THEME);
const CLIENT_THEME_INIT_SCRIPT = buildThemeInitScript(CLIENT_THEME);

interface SSRRootDocumentProps {
	children: React.ReactNode;
}

/** 前台路由：SSR 渲染 + 国际化 Provider */
export function SSRRootDocument({ children }: SSRRootDocumentProps) {
	const { locale, systemConfig } = useGlobalStore();
	const siteName = systemConfig?.site_name || "FSDX";
	const { user, isLoading } = useClientAuth();
	const trackInitialized = useRef(false);

	// 登录状态就绪后初始化追踪 SDK（仅一次），确保首次 PageView 携带正确的 userId
	useEffect(() => {
		if (isLoading || trackInitialized.current) return;
		trackInitialized.current = true;

		setUserId(user?.id);
		trackInit({ autoPageView: true });
		startRouteTracking();

		return () => {
			stopRouteTracking();
		};
	}, [isLoading, user?.id]);

	// 登录/退出时同步 userId 到追踪 SDK
	useEffect(() => {
		if (isLoading) return;
		setUserId(user?.id);
	}, [isLoading, user?.id]);

	return (
		<html lang={locale} suppressHydrationWarning>
			<head>
				<script
					dangerouslySetInnerHTML={{ __html: CLIENT_THEME_INIT_SCRIPT }}
				/>
				<style dangerouslySetInnerHTML={{ __html: LAYER_ORDER_STYLE }} />
				<style dangerouslySetInnerHTML={{ __html: ssrGlobalCss }} />
				<link
					rel="icon"
					type="image/svg+xml"
					href="/favicon.svg"
					media="(prefers-color-scheme: light)"
				/>
				<link
					rel="icon"
					type="image/svg+xml"
					href="/favicon-dark.svg"
					media="(prefers-color-scheme: dark)"
				/>
				<link rel="manifest" href="/manifest.json" />
				<meta name="theme-color" content="#ffffff" />
				<title>{siteName}</title>
				{systemConfig?.description && (
					<meta name="description" content={systemConfig.description} />
				)}
				{systemConfig?.keywords && (
					<meta name="keywords" content={systemConfig.keywords} />
				)}
				<HeadContent />
			</head>
			<body className="font-sans antialiased flex min-h-screen flex-col">
				<Header />
				<div className="flex-1">{children}</div>
				<Toaster position="top-center" richColors />
				<Footer />
				<Scripts />
			</body>
		</html>
	);
}

/** Admin 路由：客户端渲染，集成主题管理与 antd ConfigProvider */
export function AdminRootDocument({
	children,
	siteName = "FSDX",
}: {
	children: React.ReactNode;
	siteName?: string;
}) {
	return (
		<html lang="zh-CN" suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: ADMIN_THEME_INIT_SCRIPT }} />
				<style dangerouslySetInnerHTML={{ __html: LAYER_ORDER_STYLE }} />
				<title>{`${siteName} 管理后台`}</title>
				<HeadContent />
				<link rel="stylesheet" href={adminGlobalCss} />
				<link rel="icon" type="image/svg+xml" href="/favicon-admin.svg" />
				<meta name="theme-color" content="#ffffff" />
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
