/**
 * 管理端仪表盘：统计概览
 */
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { HardDrive, Newspaper, ShieldCheck, Users } from "lucide-react";
import { AdminShell } from "#/components/admin/AdminShell";
import { PERMISSIONS } from "#/lib/permissions";
import { permGuard } from "#/middleware/server-fn-auth";
import { getStats } from "#/server/stats";

const getStatsFn = createServerFn({ method: "GET" })
	.middleware([permGuard(PERMISSIONS.DASHBOARD_VIEW)])
	.handler(async () => {
		return getStats();
	});

export const Route = createFileRoute("/admin/_admin/")({
	component: Dashboard,
	loader: async () => await getStatsFn(),
});

function formatStorage(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024)
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function Dashboard() {
	const stats = Route.useLoaderData();

	return (
		<AdminShell>
			<div>
				<h1 className="text-2xl font-bold text-zinc-900">仪表盘</h1>
				<p className="mt-2 text-zinc-500">欢迎使用 CMS 管理系统</p>

				<div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<StatCard
						icon={<Newspaper size={20} />}
						label="新闻总数"
						value={stats.newsTotal}
						sub={`已发布 ${stats.publishedNews} 篇`}
						color="blue"
					/>
					<StatCard
						icon={<ShieldCheck size={20} />}
						label="管理员"
						value={stats.adminTotal}
						color="purple"
					/>
					<StatCard
						icon={<Users size={20} />}
						label="客户端用户"
						value={stats.clientTotal}
						color="green"
					/>
					<StatCard
						icon={<HardDrive size={20} />}
						label="存储用量"
						value={formatStorage(stats.storageTotal)}
						color="orange"
					/>
				</div>
			</div>
		</AdminShell>
	);
}

function StatCard({
	icon,
	label,
	value,
	sub,
	color,
}: {
	icon: React.ReactNode;
	label: string;
	value: number | string;
	sub?: string;
	color: "blue" | "purple" | "green" | "orange";
}) {
	const colorMap = {
		blue: "bg-blue-50 text-blue-600",
		purple: "bg-purple-50 text-purple-600",
		green: "bg-green-50 text-green-600",
		orange: "bg-orange-50 text-orange-600",
	};

	return (
		<div className="rounded-lg border border-zinc-200 bg-white p-5">
			<div className="flex items-center justify-between">
				<div className="text-sm text-zinc-500">{label}</div>
				<div className={`rounded-lg p-2 ${colorMap[color]}`}>{icon}</div>
			</div>
			<div className="mt-3 text-2xl font-bold text-zinc-900">{value}</div>
			{sub && <div className="mt-1 text-xs text-zinc-400">{sub}</div>}
		</div>
	);
}
