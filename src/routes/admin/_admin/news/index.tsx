/**
 * 新闻列表页
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { AdminShell } from "#/components/admin/AdminShell";
import { PERMISSIONS } from "#/lib/permissions";
import { permGuard } from "#/middleware/server-fn-auth";
import {
	changeNewsStatus,
	deleteNews,
	getNewsList as getNewsListService,
} from "#/server/news";

const listSchema = z.object({
	status: z.string().optional(),
	page: z.number().optional(),
});
const idSchema = z.object({ id: z.string().min(1) });
const statusSchema = z.object({
	id: z.string().min(1),
	status: z.enum(["draft", "published", "archived"]),
});

const getNewsListFn = createServerFn({ method: "GET" })
	.middleware([permGuard(PERMISSIONS.NEWS_VIEW)])
	.inputValidator(listSchema)
	.handler(async ({ data: { status, page = 1 } }) => {
		return getNewsListService({ status, page, pageSize: 20 });
	});

const deleteNewsFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.NEWS_DELETE)])
	.inputValidator(idSchema)
	.handler(async ({ data: { id } }) => {
		await deleteNews(id);
		return { success: true };
	});

const changeStatusFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.NEWS_PUBLISH)])
	.inputValidator(statusSchema)
	.handler(async ({ data: { id, status } }) => {
		return changeNewsStatus(id, status);
	});

export const Route = createFileRoute("/admin/_admin/news/")({
	component: NewsListPage,
	loader: async () => await getNewsListFn({ data: {} }),
});

function NewsListPage() {
	const initial = Route.useLoaderData();
	const [data, setData] = useState(initial);
	const [filter, setFilter] = useState("");

	async function refresh(s?: string) {
		const status = s ?? filter;
		const result = await getNewsListFn({
			data: { status: status || undefined },
		});
		setData(result);
	}

	return (
		<AdminShell>
			<div>
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold text-zinc-900">新闻管理</h1>
					<Link
						to="/admin/news/create"
						className="flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
					>
						<Plus size={16} />
						新建新闻
					</Link>
				</div>
				<div className="mt-4 flex gap-2">
					{["", "draft", "published", "archived"].map((s) => (
						<button
							key={s}
							onClick={async () => {
								setFilter(s);
								await refresh(s);
							}}
							className={`rounded-md px-3 py-1 text-xs font-medium ${filter === s ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`}
						>
							{s === ""
								? "全部"
								: s === "draft"
									? "草稿"
									: s === "published"
										? "已发布"
										: "已归档"}
						</button>
					))}
				</div>
				<div className="mt-4 rounded-lg border border-zinc-200 bg-white">
					<table className="w-full">
						<thead>
							<tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
								<th className="px-4 py-3 font-medium">标题</th>
								<th className="px-4 py-3 font-medium">状态</th>
								<th className="px-4 py-3 font-medium">发布时间</th>
								<th className="px-4 py-3 font-medium w-32">操作</th>
							</tr>
						</thead>
						<tbody>
							{data.records.length === 0 && (
								<tr>
									<td
										colSpan={4}
										className="px-4 py-12 text-center text-sm text-zinc-400"
									>
										暂无新闻
									</td>
								</tr>
							)}
							{data.records.map((n) => (
								<tr key={n.id} className="border-b border-zinc-50 text-sm">
									<td className="px-4 py-3">
										<div className="font-medium text-zinc-800">{n.title}</div>
										<div className="text-xs text-zinc-400">{n.slug}</div>
									</td>
									<td className="px-4 py-3">
										<span
											className={`inline-block rounded-full px-2 py-0.5 text-xs ${n.status === "published" ? "bg-green-50 text-green-700" : n.status === "draft" ? "bg-yellow-50 text-yellow-700" : "bg-zinc-100 text-zinc-500"}`}
										>
											{n.status === "published"
												? "已发布"
												: n.status === "draft"
													? "草稿"
													: "已归档"}
										</span>
										{n.isPinned && (
											<span className="ml-1 text-xs text-blue-600">置顶</span>
										)}
									</td>
									<td className="px-4 py-3 text-zinc-400 text-xs">
										{n.publishedAt
											? new Date(n.publishedAt).toLocaleDateString("zh-CN")
											: "—"}
									</td>
									<td className="px-4 py-3">
										<div className="flex gap-1">
											{n.status === "draft" && (
												<button
													onClick={async () => {
														await changeStatusFn({
															data: { id: n.id, status: "published" },
														});
														await refresh();
													}}
													className="rounded p-1 text-green-500 hover:bg-green-50"
													title="发布"
												>
													发布
												</button>
											)}
											{n.status === "published" && (
												<button
													onClick={async () => {
														await changeStatusFn({
															data: { id: n.id, status: "archived" },
														});
														await refresh();
													}}
													className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
													title="归档"
												>
													归档
												</button>
											)}
											<Link
												to="/admin/news/$id/edit"
												params={{ id: n.id }}
												className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
											>
												<Pencil size={14} />
											</Link>
											<button
												onClick={async () => {
													if (!confirm("确定删除？")) return;
													await deleteNewsFn({ data: { id: n.id } });
													await refresh();
												}}
												className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
											>
												<Trash2 size={14} />
											</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</AdminShell>
	);
}
