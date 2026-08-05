import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/admin")({
	component: RouteComponent,
	ssr: false,
});

function RouteComponent() {
	return <Outlet />;
}
