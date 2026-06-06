/**
 * 根路由：根据路径前缀分离 Admin（客户端渲染）与前台（SSR）
 */

import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, useRouterState } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import {
	AdminRootDocument,
	SSRRootDocument,
} from "#/components/admin/document";
import {
	DefaultErrorFallback,
	NotFoundFallback,
} from "../components/ErrorFallback";

export const Route = createRootRoute({
	errorComponent: DefaultErrorFallback,
	notFoundComponent: NotFoundFallback,
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
