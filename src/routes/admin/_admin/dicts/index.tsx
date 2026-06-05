// @ts-nocheck
/**
 * 字典管理页面：字典类型 + 条目 CRUD
 */

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, isNull } from "drizzle-orm";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { AdminShell } from "#/components/admin/AdminShell";
import { db } from "#/db/index";
import { dict, dictItem } from "#/db/schema";
import { loadDictCache } from "#/server/dict";

const dictIdSchema = z.object({ dictId: z.string().min(1) });
const idSchema = z.object({ id: z.string().min(1) });
const createDictSchema = z.object({
	name: z.string().min(1).max(100),
	slug: z.string().min(1).max(50),
	description: z.string().optional(),
});
const updateDictSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1).max(100).optional(),
	description: z.string().optional(),
});
const createItemSchema = z.object({
	dictId: z.string().min(1),
	label: z.string().min(1).max(100),
	value: z.string().min(1).max(100),
	sortOrder: z.number().default(0),
});
const updateItemSchema = z.object({
	id: z.string().min(1),
	label: z.string().max(100).optional(),
	value: z.string().max(100).optional(),
	sortOrder: z.number().optional(),
	status: z.string().optional(),
});

const getDictList = createServerFn({ method: "GET" }).handler(async () =>
	db
		.select()
		.from(dict)
		.where(isNull(dict.deletedAt))
		.orderBy(asc(dict.createdAt)),
);

const getDictItems = createServerFn({ method: "GET" })
	.inputValidator(dictIdSchema)
	.handler(async ({ data: { dictId } }) =>
		db
			.select()
			.from(dictItem)
			.where(and(isNull(dictItem.deletedAt), eq(dictItem.dictId, dictId)))
			.orderBy(asc(dictItem.sortOrder)),
	);

const createDictFn = createServerFn({ method: "POST" })
	.inputValidator(createDictSchema)
	.handler(async ({ data }) => {
		await db.insert(dict).values(data);
		await loadDictCache();
		return { success: true };
	});

const updateDictFn = createServerFn({ method: "POST" })
	.inputValidator(updateDictSchema)
	.handler(async ({ data }) => {
		const { id, ...rest } = data;
		await db
			.update(dict)
			.set({ ...rest, updatedAt: new Date() })
			.where(eq(dict.id, id));
		return { success: true };
	});

const deleteDictFn = createServerFn({ method: "POST" })
	.inputValidator(idSchema)
	.handler(async ({ data: { id } }) => {
		const now = new Date();
		await db.transaction(async (tx) => {
			await tx
				.update(dictItem)
				.set({ deletedAt: now })
				.where(eq(dictItem.dictId, id));
			await tx.update(dict).set({ deletedAt: now }).where(eq(dict.id, id));
		});
		await loadDictCache();
		return { success: true };
	});

const createDictItemFn = createServerFn({ method: "POST" })
	.inputValidator(createItemSchema)
	.handler(async ({ data }) => {
		await db.insert(dictItem).values(data);
		await loadDictCache();
		return { success: true };
	});

const updateDictItemFn = createServerFn({ method: "POST" })
	.inputValidator(updateItemSchema)
	.handler(async ({ data }) => {
		const { id, ...rest } = data;
		await db
			.update(dictItem)
			.set({ ...rest, updatedAt: new Date() })
			.where(eq(dictItem.id, id));
		await loadDictCache();
		return { success: true };
	});

const deleteDictItemFn = createServerFn({ method: "POST" })
	.inputValidator(idSchema)
	.handler(async ({ data: { id } }) => {
		await db
			.update(dictItem)
			.set({ deletedAt: new Date() })
			.where(eq(dictItem.id, id));
		await loadDictCache();
		return { success: true };
	});

export const Route = createFileRoute("/admin/_admin/dicts/")({
	component: DictsPage,
	loader: async () => await getDictList(),
});

function DictsPage() {
	const router = useRouter();
	const dictList = Route.useLoaderData();
	const [selectedDictId, setSelectedDictId] = useState<string | null>(null);
	const [items, setItems] = useState<(typeof dictItem.$inferSelect)[]>([]);
	const [showDictForm, setShowDictForm] = useState(false);
	const [editingDict, setEditingDict] = useState<
		typeof dict.$inferSelect | null
	>(null);
	const [showItemForm, setShowItemForm] = useState(false);
	const [editingItem, setEditingItem] = useState<
		typeof dictItem.$inferSelect | null
	>(null);

	const refreshItems = async (dictId: string) => {
		const data = await getDictItems({ data: { dictId } });
		setItems(data);
	};
	const handleSelectDict = (dictId: string) => {
		setSelectedDictId(dictId);
		refreshItems(dictId);
	};

	const handleDictSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		const form = new FormData(e.currentTarget);
		if (editingDict) {
			await updateDictFn({
				data: {
					id: editingDict.id,
					name: form.get("name") as string,
					description: (form.get("description") as string) || undefined,
				},
			});
		} else {
			await createDictFn({
				data: {
					name: form.get("name") as string,
					slug: form.get("slug") as string,
					description: (form.get("description") as string) || undefined,
				},
			});
		}
		setShowDictForm(false);
		setEditingDict(null);
		router.invalidate();
	};

	const handleItemSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!selectedDictId) return;
		const form = new FormData(e.currentTarget);
		const sortOrder = Number(form.get("sortOrder")) || 0;
		if (editingItem) {
			await updateDictItemFn({
				data: {
					id: editingItem.id,
					label: form.get("label") as string,
					value: form.get("value") as string,
					sortOrder,
				},
			});
		} else {
			await createDictItemFn({
				data: {
					dictId: selectedDictId,
					label: form.get("label") as string,
					value: form.get("value") as string,
					sortOrder,
				},
			});
		}
		setShowItemForm(false);
		setEditingItem(null);
		refreshItems(selectedDictId);
	};

	return (
		<AdminShell>
			<div>
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold text-zinc-900">字典管理</h1>
					<button
						onClick={() => {
							setEditingDict(null);
							setShowDictForm(true);
						}}
						className="flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
					>
						<Plus size={16} />
						新建字典
					</button>
				</div>
				<div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
					<div className="rounded-lg border border-zinc-200 bg-white">
						<div className="border-b border-zinc-200 px-4 py-3">
							<h2 className="text-sm font-medium text-zinc-700">字典类型</h2>
						</div>
						<div className="divide-y divide-zinc-100">
							{dictList.length === 0 && (
								<div className="px-4 py-8 text-center text-sm text-zinc-400">
									暂无字典
								</div>
							)}
							{dictList.map((d) => (
								<div
									key={d.id}
									onClick={() => handleSelectDict(d.id)}
									className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-50 ${selectedDictId === d.id ? "bg-zinc-50" : ""}`}
								>
									<div>
										<div className="text-sm font-medium text-zinc-800">
											{d.name}
										</div>
										<div className="text-xs text-zinc-400">{d.slug}</div>
									</div>
									<div className="flex gap-1">
										<button
											onClick={(e) => {
												e.stopPropagation();
												setEditingDict(d);
												setShowDictForm(true);
											}}
											className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
										>
											<Pencil size={14} />
										</button>
										<button
											onClick={async (e) => {
												e.stopPropagation();
												if (!confirm("确定删除？")) return;
												await deleteDictFn({ data: { id: d.id } });
												if (selectedDictId === d.id) {
													setSelectedDictId(null);
													setItems([]);
												}
												router.invalidate();
											}}
											className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
										>
											<Trash2 size={14} />
										</button>
									</div>
								</div>
							))}
						</div>
					</div>
					<div className="rounded-lg border border-zinc-200 bg-white lg:col-span-2">
						<div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
							<h2 className="text-sm font-medium text-zinc-700">
								{selectedDictId ? "字典条目" : "请选择左侧字典"}
							</h2>
							{selectedDictId && (
								<button
									onClick={() => {
										setEditingItem(null);
										setShowItemForm(true);
									}}
									className="flex items-center gap-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
								>
									<Plus size={14} />
									新建条目
								</button>
							)}
						</div>
						{!selectedDictId && (
							<div className="px-4 py-12 text-center text-sm text-zinc-400">
								请选择左侧字典查看条目
							</div>
						)}
						{selectedDictId && (
							<table className="w-full">
								<thead>
									<tr className="border-b border-zinc-100 text-left text-xs text-zinc-500">
										<th className="px-4 py-2 font-medium">标签</th>
										<th className="px-4 py-2 font-medium">值</th>
										<th className="px-4 py-2 font-medium">排序</th>
										<th className="px-4 py-2 font-medium">状态</th>
										<th className="px-4 py-2 font-medium w-20">操作</th>
									</tr>
								</thead>
								<tbody>
									{items.length === 0 && (
										<tr>
											<td
												colSpan={5}
												className="px-4 py-8 text-center text-sm text-zinc-400"
											>
												暂无条目
											</td>
										</tr>
									)}
									{items.map((item) => (
										<tr
											key={item.id}
											className="border-b border-zinc-50 text-sm"
										>
											<td className="px-4 py-2.5 text-zinc-800">
												{item.label}
											</td>
											<td className="px-4 py-2.5 text-zinc-500 font-mono text-xs">
												{item.value}
											</td>
											<td className="px-4 py-2.5 text-zinc-500">
												{item.sortOrder}
											</td>
											<td className="px-4 py-2.5">
												<span
													className={`inline-block rounded-full px-2 py-0.5 text-xs ${item.status === "active" ? "bg-green-50 text-green-700" : "bg-zinc-100 text-zinc-500"}`}
												>
													{item.status === "active" ? "启用" : "禁用"}
												</span>
											</td>
											<td className="px-4 py-2.5">
												<div className="flex gap-1">
													<button
														onClick={() => {
															setEditingItem(item);
															setShowItemForm(true);
														}}
														className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
													>
														<Pencil size={13} />
													</button>
													<button
														onClick={async () => {
															if (!confirm("确定删除？")) return;
															await deleteDictItemFn({ data: { id: item.id } });
															refreshItems(selectedDictId);
														}}
														className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500"
													>
														<Trash2 size={13} />
													</button>
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						)}
					</div>
				</div>
				{showDictForm && (
					<Modal
						onClose={() => {
							setShowDictForm(false);
							setEditingDict(null);
						}}
					>
						<h3 className="mb-4 text-lg font-medium text-zinc-900">
							{editingDict ? "编辑字典" : "新建字典"}
						</h3>
						<form onSubmit={handleDictSubmit} className="space-y-3">
							<FormField label="名称" required>
								<input
									name="name"
									defaultValue={editingDict?.name}
									className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
									required
								/>
							</FormField>
							<FormField label="标识 (slug)" required={!editingDict}>
								<input
									name="slug"
									defaultValue={editingDict?.slug}
									disabled={!!editingDict}
									className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 disabled:bg-zinc-50"
									required={!editingDict}
								/>
							</FormField>
							<FormField label="描述">
								<textarea
									name="description"
									defaultValue={editingDict?.description ?? ""}
									rows={2}
									className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
								/>
							</FormField>
							<div className="flex justify-end gap-2 pt-2">
								<button
									type="button"
									onClick={() => {
										setShowDictForm(false);
										setEditingDict(null);
									}}
									className="rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
								>
									取消
								</button>
								<button
									type="submit"
									className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
								>
									{editingDict ? "保存" : "创建"}
								</button>
							</div>
						</form>
					</Modal>
				)}
				{showItemForm && (
					<Modal
						onClose={() => {
							setShowItemForm(false);
							setEditingItem(null);
						}}
					>
						<h3 className="mb-4 text-lg font-medium text-zinc-900">
							{editingItem ? "编辑条目" : "新建条目"}
						</h3>
						<form onSubmit={handleItemSubmit} className="space-y-3">
							<FormField label="标签" required>
								<input
									name="label"
									defaultValue={editingItem?.label}
									className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
									required
								/>
							</FormField>
							<FormField label="值" required>
								<input
									name="value"
									defaultValue={editingItem?.value}
									className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
									required
								/>
							</FormField>
							<FormField label="排序">
								<input
									name="sortOrder"
									type="number"
									defaultValue={editingItem?.sortOrder ?? 0}
									className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
								/>
							</FormField>
							<div className="flex justify-end gap-2 pt-2">
								<button
									type="button"
									onClick={() => {
										setShowItemForm(false);
										setEditingItem(null);
									}}
									className="rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
								>
									取消
								</button>
								<button
									type="submit"
									className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800"
								>
									{editingItem ? "保存" : "创建"}
								</button>
							</div>
						</form>
					</Modal>
				)}
			</div>
		</AdminShell>
	);
}

function Modal({
	children,
	onClose,
}: {
	children: React.ReactNode;
	onClose: () => void;
}) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<div className="absolute inset-0 bg-black/30" onClick={onClose} />
			<div className="relative w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-lg">
				<button
					onClick={onClose}
					className="absolute right-4 top-4 rounded p-0.5 text-zinc-400 hover:text-zinc-600"
				>
					<X size={18} />
				</button>
				{children}
			</div>
		</div>
	);
}

function FormField({
	label,
	required,
	children,
}: {
	label: string;
	required?: boolean;
	children: React.ReactNode;
}) {
	return (
		<div>
			<label className="mb-1 block text-sm font-medium text-zinc-700">
				{label}
				{required && <span className="ml-0.5 text-red-500">*</span>}
			</label>
			{children}
		</div>
	);
}
