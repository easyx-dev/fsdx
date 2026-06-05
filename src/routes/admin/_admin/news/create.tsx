// @ts-nocheck
/**
 * 新建新闻页面（TipTap 富文本编辑器）
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { AdminShell } from "#/components/admin/AdminShell";
import { NewsEditor } from "#/components/admin/NewsEditor";
import { db } from "#/db/index";
import { news } from "#/db/schema";
import { PERMISSIONS } from "#/lib/permissions";
import { permGuard } from "#/middleware/server-fn-auth";

const createSchema = z.object({
	title: z.string().min(1, "标题不能为空").max(500),
	slug: z.string().max(500).optional(),
	summary: z.string().optional(),
	content: z.string().optional(),
	status: z.enum(["draft", "published"]).default("draft"),
	isPinned: z.boolean().default(false),
});

const createNewsFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.NEWS_CREATE)])
	.inputValidator(createSchema)
	.handler(async ({ data }) => {
		const generateSlug = (t: string) => {
			const hasChinese = /[\u4e00-\u9fff]/.test(t);
			return hasChinese
				? `news-${Date.now()}`
				: t
						.toLowerCase()
						.replace(/[^\w\s-]/g, "")
						.replace(/\s+/g, "-")
						.slice(0, 100) || `news-${Date.now()}`;
		};
		let slug = data.slug?.trim() || generateSlug(data.title);
		let counter = 1;
		while (
			await db.query.news.findFirst({
				where: (t, { eq: e, and, isNull: n }) =>
					and(e(t.slug, slug), n(t.deletedAt)),
			})
		) {
			slug = `${data.slug || generateSlug(data.title)}-${counter}`;
			counter++;
		}
		const [record] = await db
			.insert(news)
			.values({
				title: data.title,
				slug,
				summary: data.summary,
				content: data.content,
				status: data.status,
				isPinned: data.isPinned,
				publishedAt: data.status === "published" ? new Date() : null,
			})
			.returning();
		return record;
	});

export const Route = createFileRoute("/admin/_admin/news/create")({
	component: NewsCreatePage,
});

function NewsCreatePage() {
	const navigate = useNavigate();
	const [title, setTitle] = useState("");
	const [slug, setSlug] = useState("");
	const [summary, setSummary] = useState("");
	const [content, setContent] = useState("");
	const [status, setStatus] = useState("draft");
	const [isPinned, setIsPinned] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!title.trim()) {
			setError("标题不能为空");
			return;
		}
		setSaving(true);
		setError("");
		try {
			const record = await createNewsFn({
				data: {
					title,
					slug: slug || undefined,
					summary: summary || undefined,
					content: content || undefined,
					status: status as "draft" | "published",
					isPinned,
				},
			});
			navigate({ to: "/admin/news/$id/edit", params: { id: record.id } });
		} catch (err) {
			console.error("[新闻创建失败]", err);
			setError("保存失败");
		} finally {
			setSaving(false);
		}
	};

	return (
		<AdminShell>
			<div className="max-w-4xl">
				<h1 className="text-2xl font-bold text-zinc-900">新建新闻</h1>
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
							Slug（留空自动生成）
						</label>
						<input
							id="slug"
							value={slug}
							onChange={(e) => setSlug(e.target.value)}
							className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm font-mono focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
							placeholder="自动生成"
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
