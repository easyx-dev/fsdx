/**
 * 角色管理（占位）
 */
import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "#/components/admin/AdminShell";

export const Route = createFileRoute("/admin/roles/")({
	component: () => (
		<AdminShell>
			<h1 className="text-2xl font-bold text-zinc-900">角色管理</h1>
			<p className="mt-2 text-zinc-500">功能开发中</p>
		</AdminShell>
	),
});
