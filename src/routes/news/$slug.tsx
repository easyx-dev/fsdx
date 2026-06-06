/**
 * 新闻详情页（SSR）
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { getNewsBySlug } from "#/server/news";

const getNewsDetail = createServerFn({ method: "GET" })
	.inputValidator(z.object({ slug: z.string().min(1) }))
	.handler(async ({ data: { slug } }) => {
		return getNewsBySlug(slug);
	});

export const Route = createFileRoute("/news/$slug")({
	component: NewsDetailPage,
	loader: async ({ params }) =>
		await getNewsDetail({ data: { slug: params.slug } }),
});

function NewsDetailPage() {
	const data = Route.useLoaderData();

	if (!data) {
		return (
			<main className="mx-auto max-w-3xl px-4 py-20 text-center">
				<p className="text-lg text-zinc-400">新闻不存在或未发布</p>
				<Link
					to="/"
					className="mt-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700"
				>
					<ArrowLeft size={14} /> 返回首页
				</Link>
			</main>
		);
	}

	return (
		<main className="mx-auto max-w-3xl px-4 py-12">
			<Link
				to="/"
				className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-600 mb-8"
			>
				<ArrowLeft size={14} /> 返回首页
			</Link>

			<article>
				<header className="mb-8">
					<h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
						{data.title}
					</h1>
					<div className="mt-4 flex items-center gap-4 text-sm text-zinc-400">
						{data.publishedAt && (
							<time>
								{new Date(data.publishedAt).toLocaleDateString("zh-CN", {
									year: "numeric",
									month: "long",
									day: "numeric",
								})}
							</time>
						)}
					</div>
				</header>

				{data.summary && (
					<p className="mb-8 text-lg leading-relaxed text-zinc-500 border-l-2 border-zinc-200 pl-4">
						{data.summary}
					</p>
				)}

				<div
					className="prose prose-zinc max-w-none"
					dangerouslySetInnerHTML={{ __html: data.html || "" }}
				/>
			</article>
		</main>
	);
}
