/**
 * 根路由：根据路径前缀分离 Admin（客户端渲染）与前台（SSR）
 * locale 由 localeMiddleware 注入 request context，通过 getLocaleBundleSFn 读取
 */

import type { Locale } from "@fsdx/core/i18n-types";
import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRouteWithContext,
	useLocation,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Fragment } from "react";
import { ClientAuthProvider } from "#/components/client";
import { AdminRootDocument, SSRRootDocument } from "#/components/Document";
import { GlobalStoreProvider } from "#/components/providers";
import { getVisibleConfigsSFn } from "#/services/config/config.functions";
import { getLocaleBundleSFn } from "#/services/i18n/i18n.functions";

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
	async loader({ context }) {
		void context.locale;
		const [bundle, systemConfig] = await Promise.all([
			getLocaleBundleSFn(),
			getVisibleConfigsSFn(),
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
	const data = Route.useLoaderData();

	const isAdmin = pathname.startsWith("/admin");
	return (
		<Fragment>
			{isAdmin ? (
				<AdminRootDocument siteName={data.systemConfig?.site_name}>
					{children}
				</AdminRootDocument>
			) : (
				<GlobalStoreProvider
					value={{
						locale: data.locale,
						translations: data.translations,
						systemConfig: data.systemConfig,
					}}
				>
					<ClientAuthProvider>
						<SSRRootDocument>{children}</SSRRootDocument>
					</ClientAuthProvider>
				</GlobalStoreProvider>
			)}
			<TanStackDevtools
				config={{ position: "bottom-right" }}
				plugins={[
					{
						name: "Tanstack Router",
						render: <TanStackRouterDevtoolsPanel />,
					},
				]}
			/>
		</Fragment>
	);
}
