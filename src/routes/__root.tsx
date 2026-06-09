/**
 * 根路由：根据路径前缀分离 Admin（客户端渲染）与前台（SSR）
 * locale 由 start.ts 全局中间件注入 context，beforeLoad 仅加载翻译
 */

import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRouteWithContext,
	useLocation,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Fragment } from "react";
import { AdminRootDocument, SSRRootDocument } from "#/components/Document";
import { GlobalStoreProvider } from "#/lib/global-store/global-store";
import type { Locale, Translations } from "#/lib/i18n/i18n.types";
import { getI18nBundle } from "#/server/i18n/i18n.functions";

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
		const translations = await getI18nBundle({
			data: { locale: context.locale },
		});
		return { locale: context.locale, translations };
	},
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	const pathname = useLocation().pathname;
	const context = Route.useRouteContext() as {
		locale: Locale;
		translations: Translations;
	};

	const isAdmin = pathname.startsWith("/admin");
	return (
		<Fragment>
			{isAdmin ? (
				<AdminRootDocument>{children}</AdminRootDocument>
			) : (
				<GlobalStoreProvider
					value={{ locale: context.locale, translations: context.translations }}
				>
					<SSRRootDocument>{children}</SSRRootDocument>
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
