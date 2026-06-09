/**
 * 新闻详情页（SSR）
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { Button } from "#/components/ui/button";
import { useTranslation } from "#/lib/i18n/i18n-context";
import { getNewsBySlug, translateNewsRecord } from "#/server/news/news.server";

const getNewsDetail = createServerFn({ method: "GET" })
	.inputValidator(z.object({ slug: z.string().min(1) }))
	.handler(async ({ data: { slug }, context }) => {
		const record = await getNewsBySlug(slug);
		if (!record) return null;
		const translated = await translateNewsRecord(record, context.locale);
		return { ...translated, html: translated.content ?? "" };
	});

export const Route = createFileRoute("/news/$slug")({
	component: NewsDetailPage,
	loader: async ({ params }) =>
		await getNewsDetail({ data: { slug: params.slug } }),
});

function NewsDetailPage() {
	const data = Route.useLoaderData();
	const { t, locale } = useTranslation();

	if (!data) {
		return (
			<main className="mx-auto max-w-3xl px-4 py-12 text-center sm:py-20">
				<p className="text-base text-muted-foreground sm:text-lg">
					{t("新闻不存在或未发布")}
				</p>
				<Link to="/" className="mt-4 inline-block">
					<Button variant="ghost" size="sm">
						<ArrowLeft />
						{t("返回首页")}
					</Button>
				</Link>
			</main>
		);
	}

	return (
		<main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
			<Link to="/" className="mb-6 inline-block sm:mb-8">
				<Button variant="ghost" size="sm">
					<ArrowLeft />
					{t("backHome")}
				</Button>
			</Link>

			<article>
				<header className="mb-6 sm:mb-8">
					<h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-4xl">
						{data.title}
					</h1>
					<div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground sm:mt-4 sm:gap-4">
						{data.publishedAt && (
							<time>
								{new Date(data.publishedAt).toLocaleDateString(locale, {
									year: "numeric",
									month: "long",
									day: "numeric",
								})}
							</time>
						)}
					</div>
				</header>

				{data.summary && (
					<p className="mb-6 border-l-2 border-border pl-4 text-base leading-relaxed text-muted-foreground sm:mb-8 sm:text-lg">
						{data.summary}
					</p>
				)}

				<div
					className="prose prose-zinc max-w-none prose-sm sm:prose-base"
					dangerouslySetInnerHTML={{ __html: data.html || "" }}
				/>
			</article>
		</main>
	);
}
