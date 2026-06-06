/**
 * 根路由：根据路径前缀分离 Admin（客户端渲染）与前台（SSR）
 */

import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, useRouterState } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Fragment } from "react";
import { AdminRootDocument, SSRRootDocument } from "#/components/Document";

export const Route = createRootRoute({
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
	return (
		<Fragment>
			{isAdmin ? (
				<AdminRootDocument>{children}</AdminRootDocument>
			) : (
				<SSRRootDocument>{children}</SSRRootDocument>
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
