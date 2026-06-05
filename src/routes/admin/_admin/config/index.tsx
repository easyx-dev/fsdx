/**
 * 系统配置管理页面：键值对 CRUD
 */

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { asc, eq, isNull } from "drizzle-orm";
import { Copy, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { AdminShell } from "#/components/admin/AdminShell";
import { db } from "#/db/index";
import { systemConfig } from "#/db/schema";
import { loadConfigCache } from "#/server/config";

const createConfigSchema = z.object({
	key: z.string().min(1, "配置键不能为空").max(100),
	value: z.string().min(1, "配置值不能为空"),
	description: z.string().optional(),
});
const updateConfigSchema = z.object({
	id: z.string().min(1),
	value: z.string().optional(),
	description: z.string().optional(),
});
const deleteConfigSchema = z.object({ id: z.string().min(1) });

const getConfigList = createServerFn({ method: "GET" }).handler(async () => {
	return db
		.select()
		.from(systemConfig)
		.where(isNull(systemConfig.deletedAt))
		.orderBy(asc(systemConfig.key));
});

const createConfigFn = createServerFn({ method: "POST" })
	.inputValidator(createConfigSchema)
	.handler(async ({ data }) => {
		await db.insert(systemConfig).values(data);
		await loadConfigCache();
		return { success: true };
	});

const updateConfigFn = createServerFn({ method: "POST" })
	.inputValidator(updateConfigSchema)
	.handler(async ({ data }) => {
		const { id, ...rest } = data;
		await db
			.update(systemConfig)
			.set({ ...rest, updatedAt: new Date() })
			.where(eq(systemConfig.id, id));
		await loadConfigCache();
		return { success: true };
	});

const deleteConfigFn = createServerFn({ method: "POST" })
	.inputValidator(deleteConfigSchema)
	.handler(async ({ data }) => {
		await db
			.update(systemConfig)
			.set({ deletedAt: new Date() })
			.where(eq(systemConfig.id, data.id));
		await loadConfigCache();
		return { success: true };
	});

export const Route = createFileRoute("/admin/_admin/config/")({
	component: ConfigPage,
	loader: async () => await getConfigList(),
});

function ConfigPage() {
	const router = useRouter();
	const configs = Route.useLoaderData();
	const [showForm, setShowForm] = useState(false);
	const [editing, setEditing] = useState<
		typeof systemConfig.$inferSelect | null
	>(null);
	const [copied, setCopied] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const form = new FormData(e.currentTarget);
		if (editing) {
			await updateConfigFn({
				data: {
					id: editing.id,
					value: form.get("value") as string,
					description: (form.get("description") as string) || undefined,
				},
			});
		} else {
			await createConfigFn({
				data: {
					key: form.get("key") as string,
					value: form.get("value") as string,
					description: (form.get("description") as string) || undefined,
				},
			});
		}
		setShowForm(false);
		setEditing(null);
		router.invalidate();
	};

	return (
		<AdminShell>
			<div>
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold text-zinc-900">系统配置</h1>
					<button
						onClick={() => {
							setEditing(null);
							setShowForm(true);
						}}
						className="flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
					>
						<Plus size={16} />
						新建配置
					</button>
				</div>
				<div className="mt-6 rounded-lg border border-zinc-200 bg-white">
					<table className="w-full">
						<thead>
							<tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
								<th className="px-4 py-3 font-medium">配置键</th>
								<th className="px-4 py-3 font-medium">配置值</th>
								<th className="px-4 py-3 font-medium">描述</th>
								<th className="px-4 py-3 font-medium w-24">操作</th>
							</tr>
						</thead>
						<tbody>
							{configs.length === 0 && (
								<tr>
									<td
										colSpan={4}
										className="px-4 py-12 text-center text-sm text-zinc-400"
									>
										暂无配置
									</td>
								</tr>
							)}
							{configs.map((cfg) => (
								<tr key={cfg.id} className="border-b border-zinc-50 text-sm">
									<td className="px-4 py-3">
										<span className="font-mono text-xs text-zinc-700 bg-zinc-50 px-2 py-0.5 rounded">
											{cfg.key}
										</span>
									</td>
									<td className="px-4 py-3">
										<div className="flex items-center gap-2">
											<span className="max-w-xs truncate text-zinc-600 font-mono text-xs">
												{cfg.value.length > 60
													? cfg.value.slice(0, 60) + "..."
													: cfg.value}
											</span>
											<button
												onClick={() => {
													navigator.clipboard.writeText(cfg.value);
													setCopied(cfg.value);
													setTimeout(() => setCopied(null), 2000);
												}}
												className="shrink-0 rounded p-0.5 text-zinc-300 hover:text-zinc-500"
												title="复制"
											>
												{copied === cfg.value ? (
													<span className="text-xs text-green-600">已复制</span>
												) : (
													<Copy size={13} />
												)}
											</button>
										</div>
									</td>
									<td className="px-4 py-3 text-zinc-400">
										{cfg.description || "—"}
									</td>
									<td className="px-4 py-3">
										<div className="flex gap-1">
											<button
												onClick={() => {
													setEditing(cfg);
													setShowForm(true);
												}}
												className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
											>
												<Pencil size={14} />
											</button>
											<button
												onClick={async () => {
													if (!confirm("确定删除？")) return;
													await deleteConfigFn({ data: { id: cfg.id } });
													router.invalidate();
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
				{showForm && (
					<div className="fixed inset-0 z-50 flex items-center justify-center">
						<div
							className="absolute inset-0 bg-black/30"
							onClick={() => {
								setShowForm(false);
								setEditing(null);
							}}
						/>
						<div className="relative w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-6 shadow-lg">
							<button
								onClick={() => {
									setShowForm(false);
									setEditing(null);
								}}
								className="absolute right-4 top-4 rounded p-0.5 text-zinc-400 hover:text-zinc-600"
							>
								<X size={18} />
							</button>
							<h3 className="mb-4 text-lg font-medium text-zinc-900">
								{editing ? "编辑配置" : "新建配置"}
							</h3>
							<form onSubmit={handleSubmit} className="space-y-3">
								<div>
									<label className="mb-1 block text-sm font-medium text-zinc-700">
										配置键 <span className="text-red-500">*</span>
									</label>
									<input
										name="key"
										defaultValue={editing?.key}
										disabled={!!editing}
										className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:bg-zinc-50"
										required={!editing}
									/>
								</div>
								<div>
									<label className="mb-1 block text-sm font-medium text-zinc-700">
										配置值 <span className="text-red-500">*</span>
									</label>
									<textarea
										name="value"
										defaultValue={editing?.value}
										rows={3}
										className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
										required
									/>
								</div>
								<div>
									<label className="mb-1 block text-sm font-medium text-zinc-700">
										描述
									</label>
									<input
										name="description"
										defaultValue={editing?.description ?? ""}
										className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
									/>
								</div>
								<div className="flex justify-end gap-2 pt-2">
									<button
										type="button"
										onClick={() => {
											setShowForm(false);
											setEditing(null);
										}}
										className="rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
									>
										取消
									</button>
									<button
										type="submit"
										className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
									>
										{editing ? "保存" : "创建"}
									</button>
								</div>
							</form>
						</div>
					</div>
				)}
			</div>
		</AdminShell>
	);
}
