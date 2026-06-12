/**
 * 根路由：根据路径前缀分离 Admin（客户端渲染）与前台（SSR）
 * locale 由 localeMiddleware 注入 request context，通过 getLocaleBundle 读取
 */

import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRouteWithContext,
	useLocation,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Fragment } from "react";
import { ClientAuthProvider } from "#/components/client/ClientAuthProvider";
import { AdminRootDocument, SSRRootDocument } from "#/components/Document";
import { GlobalStoreProvider } from "#/lib/global-store/global-store";
import type { Locale, Translations } from "#/lib/i18n/i18n.types";
import { getVisibleConfigsFn } from "#/server/config/config.functions";
import { getLocaleBundle } from "#/server/i18n/i18n.functions";

export const Route = createRootRouteWithContext<{
	locale: Locale;
}>()({
	head: () => {
		return {
			meta: [
				{ charSet: "utf-8" },
				{
					name: "viewport",
					content: "width=device-width, initial-scale=1",
				},
			],
		};
	},
	async beforeLoad({ context }) {
		void context.locale;
		const [bundle, systemConfig] = await Promise.all([
			getLocaleBundle(),
			getVisibleConfigsFn(),
		]);
		return { ...bundle, systemConfig };
	},
	shellComponent: RootDocument,
	errorComponent: RootError,
});

function RootError({ error }: { error: unknown }) {
	const msg =
		error instanceof Error ? error.message : "页面加载失败，请刷新重试";
	return (
		<html lang="zh-CN">
			<body className="font-sans antialiased flex min-h-screen flex-col items-center justify-center bg-background">
				<div className="text-center space-y-3 px-4">
					<p className="text-lg font-semibold text-foreground">页面加载失败</p>
					<p className="text-sm text-muted-foreground">{msg}</p>
				</div>
			</body>
		</html>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	const pathname = useLocation().pathname;
	const context = Route.useRouteContext() as {
		locale: Locale;
		translations: Translations;
		systemConfig: Record<string, string>;
	};

	const isAdmin = pathname.startsWith("/admin");
	return (
		<Fragment>
			{isAdmin ? (
				<AdminRootDocument>{children}</AdminRootDocument>
			) : (
				<GlobalStoreProvider
					value={{
						locale: context.locale,
						translations: context.translations,
						systemConfig: context.systemConfig,
					}}
				>
					<ClientAuthProvider>
						<SSRRootDocument>{children}</SSRRootDocument>
					</ClientAuthProvider>
				</GlobalStoreProvider>
			)}
			{process.env.NODE_ENV === "development" && (
				<TanStackDevtools
					config={{ position: "bottom-right" }}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
					]}
				/>
			)}
		</Fragment>
	);
}
