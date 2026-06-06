/**
 * 根路由：根据路径前缀分离 Admin（客户端渲染）与前台（SSR）
 */

import { createCache, extractStyle, StyleProvider } from "@ant-design/cssinjs";
import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRoute,
	HeadContent,
	Outlet,
	Scripts,
	useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { AuthProvider } from "../components/AuthProvider";
import { AdminLayout } from "../components/admin/AdminLayout";
import {
	DefaultErrorFallback,
	NotFoundFallback,
} from "../components/ErrorFallback";
import Footer from "../components/Footer";
import Header from "../components/Header";
import appCss from "../styles/index.css?url";

const THEME_INIT_SCRIPT = `(function(){try{var s=window.localStorage.getItem('theme');var m=(s==='light'||s==='dark'||s==='auto')?s:'auto';var d=m==='auto'?window.matchMedia('(prefers-color-scheme: dark)').matches:m==='dark';var r=document.documentElement;r.classList.remove('light','dark');r.classList.add(d?'dark':'light');if(m==='auto'){r.removeAttribute('data-theme')}else{r.setAttribute('data-theme',m)}r.style.colorScheme=d?'dark':'light'}catch(e){}})();`;

export const Route = createRootRoute({
	errorComponent: DefaultErrorFallback,
	notFoundComponent: NotFoundFallback,
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{ title: "CMS 内容管理系统" },
		],
		links: [{ rel: "stylesheet", href: appCss }],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	const pathname = useRouterState({
		select: (s) => s.location.pathname,
	});
	const isAdmin = pathname.startsWith("/admin");

	if (isAdmin) {
		return <AdminRootDocument>{children}</AdminRootDocument>;
	}
	return <SSRRootDocument>{children}</SSRRootDocument>;
}

// 前台路由：SSR 渲染
function SSRRootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="zh-CN" suppressHydrationWarning>
			<head>
				<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
				<HeadContent />
			</head>
			<body className="font-sans antialiased flex min-h-screen flex-col">
				<Header />
				<div className="flex-1">{children}</div>
				<Footer />
				<DevTools />
				<Scripts />
			</body>
		</html>
	);
}

const styleCache = createCache();
// Admin 路由：客户端渲染
function AdminRootDocument({ children }: { children: React.ReactNode }) {
	const pathname = useRouterState({
		select: (s) => s.location.pathname,
	});
	const isStandalone =
		pathname === "/admin/login" || pathname === "/admin/init";
	const isAdmin = pathname.startsWith("/admin");
	const styleText = extractStyle(styleCache);
	return (
		<html lang="zh-CN" suppressHydrationWarning>
			<head>
				<div dangerouslySetInnerHTML={{ __html: styleText }} />
				<HeadContent />
			</head>
			<body className="font-sans antialiased">
				<StyleProvider cache={styleCache}>
					{!isStandalone && isAdmin ? (
						<AuthProvider>
							<AdminLayout>{children}</AdminLayout>
						</AuthProvider>
					) : (
						children
					)}
				</StyleProvider>
				<DevTools />
				<Scripts />
			</body>
		</html>
	);
}

function DevTools() {
	return (
		<TanStackDevtools
			config={{ position: "bottom-right" }}
			plugins={[
				{
					name: "Tanstack Router",
					render: <TanStackRouterDevtoolsPanel />,
				},
			]}
		/>
	);
}
