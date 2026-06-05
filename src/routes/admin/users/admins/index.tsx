/**
 * 管理员列表（占位，阶段 2 后续实现）
 */
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "#/components/admin/AdminShell";

export const Route = createFileRoute("/admin/users/admins/")({
	component: AdminUserList,
});

function AdminUserList() {
	return (
		<AdminShell>
			<h1 className="text-2xl font-bold text-zinc-900">管理员列表</h1>
			<p className="mt-2 text-zinc-500">功能开发中</p>
		</AdminShell>
	);
}
