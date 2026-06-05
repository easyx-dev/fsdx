// @ts-nocheck
/**
 * 编辑新闻页面
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { useState } from "react";
import { z } from "zod";
import { AdminShell } from "#/components/admin/AdminShell";
import { NewsEditor } from "#/components/admin/NewsEditor";
import { db } from "#/db/index";
import { news } from "#/db/schema";

const getSchema = z.object({ id: z.string().min(1) });
const updateSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1).max(500),
	slug: z.string().max(500).optional(),
	summary: z.string().optional(),
	content: z.string().optional(),
	status: z.enum(["draft", "published", "archived"]),
	isPinned: z.boolean(),
});

const getNewsFn = createServerFn({ method: "GET" })
	.inputValidator(getSchema)
	.handler(async ({ data: { id } }) => {
		return db.query.news.findFirst({
			where: (t, { eq: e, and, isNull: n }) => and(e(t.id, id), n(t.deletedAt)),
		});
	});

const updateNewsFn = createServerFn({ method: "POST" })
	.inputValidator(updateSchema)
	.handler(async ({ data }) => {
		const updateData: Record<string, unknown> = {
			title: data.title,
			summary: data.summary,
			content: data.content,
			status: data.status,
			isPinned: data.isPinned,
			updatedAt: new Date(),
		};
		if (data.slug) updateData.slug = data.slug;
		if (data.status === "published") {
			const rec = await db.query.news.findFirst({
				where: (t, { eq: e }) => e(t.id, data.id),
			});
			if (rec && !rec.publishedAt) updateData.publishedAt = new Date();
		}
		const [updated] = await db
			.update(news)
			.set(updateData)
			.where(eq(news.id, data.id))
			.returning();
		return updated;
	});

export const Route = createFileRoute("/admin/_admin/news/$id/edit")({
	component: NewsEditPage,
	loader: async ({ params }) => await getNewsFn({ data: { id: params.id } }),
});

function NewsEditPage() {
	const navigate = useNavigate();
	const record = Route.useLoaderData();
	const [title, setTitle] = useState(record?.title || "");
	const [slug, setSlug] = useState(record?.slug || "");
	const [summary, setSummary] = useState(record?.summary || "");
	const [content, setContent] = useState(record?.content || "");
	const [status, setStatus] = useState(record?.status || "draft");
	const [isPinned, setIsPinned] = useState(record?.isPinned ?? false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	if (!record)
		return (
			<AdminShell>
				<div className="py-12 text-center text-zinc-400">新闻不存在</div>
			</AdminShell>
		);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!title.trim()) {
			setError("标题不能为空");
			return;
		}
		setSaving(true);
		setError("");
		try {
			await updateNewsFn({
				data: {
					id: record.id,
					title,
					slug: slug || undefined,
					summary: summary || undefined,
					content: content || undefined,
					status: status as "draft" | "published" | "archived",
					isPinned,
				},
			});
			navigate({ to: "/admin/news" });
		} catch {
			setError("保存失败");
		} finally {
			setSaving(false);
		}
	};

	return (
		<AdminShell>
			<div className="max-w-4xl">
				<h1 className="text-2xl font-bold text-zinc-900">编辑新闻</h1>
				{error && (
					<div className="mt-3 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
						{error}
					</div>
				)}
				<form onSubmit={handleSubmit} className="mt-6 space-y-4">
					<div>
						<label
							htmlFor="title"
							className="mb-1 block text-sm font-medium text-zinc-700"
						>
							标题 <span className="text-red-500">*</span>
						</label>
						<input
							id="title"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
							required
						/>
					</div>
					<div>
						<label
							htmlFor="slug"
							className="mb-1 block text-sm font-medium text-zinc-700"
						>
							Slug
						</label>
						<input
							id="slug"
							value={slug}
							onChange={(e) => setSlug(e.target.value)}
							className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
						/>
					</div>
					<div>
						<label
							htmlFor="summary"
							className="mb-1 block text-sm font-medium text-zinc-700"
						>
							摘要
						</label>
						<textarea
							id="summary"
							value={summary}
							onChange={(e) => setSummary(e.target.value)}
							rows={2}
							className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
						/>
					</div>
					<div>
						<label className="mb-1 block text-sm font-medium text-zinc-700">
							正文
						</label>
						<div className="rounded-md border border-zinc-300 focus-within:border-zinc-500 focus-within:ring-1 focus-within:ring-zinc-500">
							<NewsEditor content={content} onChange={setContent} />
						</div>
					</div>
					<div className="flex items-center gap-4">
						<div>
							<label
								htmlFor="status"
								className="mb-1 block text-sm font-medium text-zinc-700"
							>
								状态
							</label>
							<select
								id="status"
								value={status}
								onChange={(e) => setStatus(e.target.value)}
								className="rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
							>
								<option value="draft">草稿</option>
								<option value="published">发布</option>
								<option value="archived">归档</option>
							</select>
						</div>
						<div className="flex items-center gap-2 pt-5">
							<input
								type="checkbox"
								id="pinned"
								checked={isPinned}
								onChange={(e) => setIsPinned(e.target.checked)}
								className="rounded border-zinc-300"
							/>
							<label htmlFor="pinned" className="text-sm text-zinc-600">
								置顶
							</label>
						</div>
					</div>
					<div className="flex gap-2 pt-2">
						<button
							type="submit"
							disabled={saving}
							className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
						>
							{saving ? "保存中..." : "保存"}
						</button>
						<button
							type="button"
							onClick={() => navigate({ to: "/admin/news" })}
							className="rounded-md px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
						>
							取消
						</button>
					</div>
				</form>
			</div>
		</AdminShell>
	);
}
