/**
 * 日志查询页面：搜索/筛选操作日志文件
 */

import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { FileText, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { AdminShell } from "#/components/admin/AdminShell";
import { PERMISSIONS } from "#/lib/permissions";
import { permGuard } from "#/middleware/server-fn-auth";
import {
	getLogDates as getLogDatesService,
	type LogEntry,
	type LogQueryResult,
	searchLogs as searchLogsService,
} from "#/server/logs";

const searchLogsSchema = z.object({
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	keyword: z.string().optional(),
	level: z.string().optional(),
	page: z.number().optional(),
	pageSize: z.number().optional(),
});

const searchLogsFn = createServerFn({ method: "GET" })
	.middleware([permGuard(PERMISSIONS.LOG_VIEW)])
	.inputValidator(searchLogsSchema)
	.handler(async ({ data }) => {
		return searchLogsService(data);
	});

const getDatesFn = createServerFn({ method: "GET" })
	.middleware([permGuard(PERMISSIONS.LOG_VIEW)])
	.handler(async () => {
		return getLogDatesService();
	});

const levels = ["", "info", "warn", "error", "debug", "fatal"];
const levelColors: Record<string, string> = {
	info: "text-blue-600 bg-blue-50",
	warn: "text-yellow-600 bg-yellow-50",
	error: "text-red-600 bg-red-50",
	debug: "text-zinc-500 bg-zinc-100",
	fatal: "text-red-700 bg-red-100",
};

export const Route = createFileRoute("/admin/_admin/logs/")({
	component: LogsPage,
	loader: async () => {
		const [result, dates] = await Promise.all([
			searchLogsFn({ data: { page: 1, pageSize: 20 } }),
			getDatesFn(),
		]);
		return { result, availableDates: dates };
	},
});

function LogsPage() {
	const initial = Route.useLoaderData();
	const [result, setResult] = useState<LogQueryResult>(initial.result);
	const [dates] = useState<string[]>(initial.availableDates);
	const [keyword, setKeyword] = useState("");
	const [level, setLevel] = useState("");
	const [startDate, setStartDate] = useState("");
	const [endDate, setEndDate] = useState("");
	const [page, setPage] = useState(1);
	const pageSize = 20;

	const doSearch = async (p = 1) => {
		const data = await searchLogsFn({
			data: {
				keyword: keyword || undefined,
				level: level || undefined,
				startDate: startDate || undefined,
				endDate: endDate || undefined,
				page: p,
				pageSize,
			},
		});
		setResult(data);
		setPage(p);
	};

	const totalPages = Math.max(1, Math.ceil(result.total / pageSize));

	const formatTime = (entry: LogEntry): string => {
		const t =
			typeof entry.time === "number"
				? new Date(entry.time)
				: entry.time
					? new Date(entry.time as string)
					: new Date();
		return t.toLocaleString("zh-CN");
	};

	return (
		<AdminShell>
			<div>
				<h1 className="text-2xl font-bold text-zinc-900">日志查询</h1>
				<p className="mt-2 text-zinc-500">搜索和查看系统操作日志文件</p>

				<div className="mt-4 flex flex-wrap items-end gap-2">
					<div>
						<label className="mb-1 block text-xs text-zinc-500">关键词</label>
						<input
							value={keyword}
							onChange={(e) => setKeyword(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && doSearch()}
							placeholder="搜索日志..."
							className="w-48 rounded-md border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
						/>
					</div>
					<div>
						<label className="mb-1 block text-xs text-zinc-500">级别</label>
						<select
							value={level}
							onChange={(e) => setLevel(e.target.value)}
							className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
						>
							{levels.map((l) => (
								<option key={l} value={l}>
									{l || "全部"}
								</option>
							))}
						</select>
					</div>
					<div>
						<label className="mb-1 block text-xs text-zinc-500">开始日期</label>
						<input
							type="date"
							value={startDate}
							onChange={(e) => setStartDate(e.target.value)}
							className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
						/>
					</div>
					<div>
						<label className="mb-1 block text-xs text-zinc-500">结束日期</label>
						<input
							type="date"
							value={endDate}
							onChange={(e) => setEndDate(e.target.value)}
							className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm focus:border-zinc-500 focus:outline-none"
						/>
					</div>
					<button
						onClick={() => doSearch()}
						className="flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
					>
						<Search size={14} /> 搜索
					</button>
					<button
						onClick={() => {
							setKeyword("");
							setLevel("");
							setStartDate("");
							setEndDate("");
							doSearch();
						}}
						className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-100"
					>
						<RefreshCw size={14} /> 重置
					</button>
				</div>

				{dates.length > 0 && (
					<div className="mt-3 flex flex-wrap gap-1">
						<span className="text-xs text-zinc-400 mr-1">日志日期：</span>
						{dates.slice(0, 14).map((d: string) => (
							<button
								key={d}
								onClick={() => {
									setStartDate(d);
									setEndDate(d);
									doSearch();
								}}
								className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-200"
							>
								{d}
							</button>
						))}
					</div>
				)}

				<div className="mt-4 rounded-lg border border-zinc-200 bg-white">
					<div className="border-b border-zinc-200 px-4 py-3 flex items-center justify-between">
						<span className="text-sm text-zinc-600">
							共{" "}
							<span className="font-medium text-zinc-900">{result.total}</span>{" "}
							条日志
						</span>
						<span className="text-xs text-zinc-400">
							第 {result.page}/{totalPages} 页
						</span>
					</div>

					<div className="divide-y divide-zinc-50">
						{result.entries.length === 0 && (
							<div className="px-4 py-16 text-center">
								<FileText size={32} className="mx-auto mb-2 text-zinc-300" />
								<p className="text-sm text-zinc-400">
									{result.total === 0 ? "暂无日志" : "未找到匹配"}
								</p>
							</div>
						)}
						{result.entries.map((entry: LogEntry, i: number) => (
							<div key={i} className="px-4 py-2.5 text-sm">
								<div className="flex items-center gap-2">
									<span className="text-xs text-zinc-400 whitespace-nowrap">
										{formatTime(entry)}
									</span>
									<span
										className={`rounded px-1.5 py-0.5 text-xs font-mono font-medium ${levelColors[entry.level] || "text-zinc-500 bg-zinc-100"}`}
									>
										{entry.level.toUpperCase()}
									</span>
									<span className="font-mono text-xs text-zinc-600 flex-1 truncate">
										{entry.msg ?? ""}
									</span>
								</div>
							</div>
						))}
					</div>

					{totalPages > 1 && (
						<div className="flex items-center justify-center gap-1 border-t border-zinc-200 px-4 py-2">
							<button
								disabled={page <= 1}
								onClick={() => doSearch(page - 1)}
								className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
							>
								上一页
							</button>
							{Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
								const p =
									page <= 4
										? i + 1
										: page >= totalPages - 3
											? totalPages - 6 + i
											: page - 3 + i;
								if (p < 1 || p > totalPages) return null;
								return (
									<button
										key={p}
										onClick={() => doSearch(p)}
										className={`rounded px-2 py-1 text-xs ${p === page ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100"}`}
									>
										{p}
									</button>
								);
							})}
							<button
								disabled={page >= totalPages}
								onClick={() => doSearch(page + 1)}
								className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
							>
								下一页
							</button>
						</div>
					)}
				</div>
			</div>
		</AdminShell>
	);
}
