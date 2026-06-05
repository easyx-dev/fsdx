/**
 * 客户端用户列表（占位）
 */
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "#/components/admin/AdminShell";

export const Route = createFileRoute("/admin/users/clients/")({
	component: ClientUserList,
});

function ClientUserList() {
	return (
		<AdminShell>
			<h1 className="text-2xl font-bold text-zinc-900">客户端用户列表</h1>
			<p className="mt-2 text-zinc-500">功能开发中</p>
		</AdminShell>
	);
}
