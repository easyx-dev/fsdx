import { DEFAULT_LOCALE } from "@fsdx/core/i18n-types";
import { createRouter } from "@tanstack/react-router";
import {
	DefaultErrorFallback,
	NotFoundFallback,
} from "./components/ErrorFallback";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const router = createRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		defaultErrorComponent: ({ error, reset }) => (
			<DefaultErrorFallback error={error} reset={reset} />
		),
		defaultNotFoundComponent: () => {
			return <NotFoundFallback />;
		},
		context: {
			locale: DEFAULT_LOCALE,
		},
	});

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
