/**
 * 根路由 Document 外壳：分离 Admin（客户端渲染）与前台（SSR + 国际化）
 */

import { ClientOnly, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Toaster } from "sonner";
import { useClientAuth } from "#/components/client/ClientAuthProvider";
import Footer from "#/components/client/Footer";
import Header from "#/components/client/Header";
import { useGlobalStore } from "#/lib/global-store/global-store";
import {
	setUserId,
	startRouteTracking,
	stopRouteTracking,
	init as trackInit,
} from "#/lib/track/track";
import adminGlobalCss from "#/styles/admin.global.css?url";
import ssrGlobalCss from "#/styles/ssr.global.css?inline";
import { AdminProvider } from "./admin/AdminProvider";

const THEME_INIT_SCRIPT = `(function(){try{var s=window.localStorage.getItem('theme');var m=(s==='light'||s==='dark'||s==='auto')?s:'auto';var d=m==='auto'?window.matchMedia('(prefers-color-scheme: dark)').matches:m==='dark';var r=document.documentElement;r.classList.remove('light','dark');r.classList.add(d?'dark':'light');if(m==='auto'){r.removeAttribute('data-theme')}else{r.setAttribute('data-theme',m)}r.style.colorScheme=d?'dark':'light'}catch(e){}})();`;

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
				<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
				<style dangerouslySetInnerHTML={{ __html: ssrGlobalCss }} />
				<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
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
				<title>{siteName} 管理后台</title>
				<HeadContent />
				<link rel="stylesheet" href={adminGlobalCss} />
				<link rel="icon" type="image/svg+xml" href="/favicon-admin.svg" />
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
