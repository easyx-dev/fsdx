import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import {
	DefaultErrorFallback,
	NotFoundFallback,
} from "./components/ErrorFallback";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
	const router = createTanStackRouter({
		routeTree,
		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		defaultErrorComponent: DefaultErrorFallback,
		defaultNotFoundComponent: NotFoundFallback,
	});

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
