/**
 * 根路由 Document 外壳：分离 Admin（客户端渲染）与前台（SSR + 国际化）
 */

import { ClientOnly, HeadContent, Scripts } from "@tanstack/react-router";
import Footer from "#/components/Footer";
import Header from "#/components/Header";
import { useGlobalStore } from "#/lib/global-store/global-store";
import adminGlobalCss from "#/styles/admin.global.css?url";
import ssrGlobalCss from "#/styles/ssr.global.css?url";
import { AdminProvider } from "./admin/AdminProvider";

const THEME_INIT_SCRIPT = `(function(){try{var s=window.localStorage.getItem('theme');var m=(s==='light'||s==='dark'||s==='auto')?s:'auto';var d=m==='auto'?window.matchMedia('(prefers-color-scheme: dark)').matches:m==='dark';var r=document.documentElement;r.classList.remove('light','dark');r.classList.add(d?'dark':'light');if(m==='auto'){r.removeAttribute('data-theme')}else{r.setAttribute('data-theme',m)}r.style.colorScheme=d?'dark':'light'}catch(e){}})();`;

interface SSRRootDocumentProps {
	children: React.ReactNode;
}

/** 前台路由：SSR 渲染 + 国际化 Provider */
export function SSRRootDocument({ children }: SSRRootDocumentProps) {
	const { locale } = useGlobalStore();
	return (
		<html lang={locale} suppressHydrationWarning>
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

/** Admin 路由：客户端渲染，集成主题管理与 antd ConfigProvider */
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
