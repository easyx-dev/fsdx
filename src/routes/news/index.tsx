/**
 * 新闻列表页（SSR）：分页展示已发布新闻
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Badge } from "#/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { useTranslation } from "#/lib/i18n/i18n-context";
import { formatDate } from "#/lib/utils/format-date";
import type { NewsRecord } from "#/server/news/news.server";
import { getNewsList, translateNewsRecords } from "#/server/news/news.server";

const getPublishedNewsSFn = createServerFn({ method: "GET" })
	.inputValidator(
		z.object({
			page: z.number().int().min(1).optional().default(1),
			pageSize: z.number().int().min(1).max(50).optional().default(12),
		}),
	)
	.handler(async ({ data, context }) => {
		const { records, ...rest } = await getNewsList({
			status: "published",
			...data,
		});
		return {
			records: await translateNewsRecords(records, context.locale),
			...rest,
		};
	});

export const Route = createFileRoute("/news/")({
	component: NewsListPage,
	loader: async () => await getPublishedNewsSFn({ data: { page: 1 } }),
	errorComponent: NewsListError,
});

function NewsListError({ error }: { error: unknown }) {
	const msg = error instanceof Error ? error.message : "加载失败，请稍后重试";
	return (
		<main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
			<header className="mb-6 sm:mb-10">
				<h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
					新闻资讯
				</h1>
			</header>
			<div className="py-20 text-center">
				<p className="text-sm text-destructive">{msg}</p>
			</div>
		</main>
	);
}

function NewsListPage() {
	const data = Route.useLoaderData();
	const { records, total, page, pageSize } = data;
	const totalPages = Math.ceil(total / pageSize);
	const { t, locale } = useTranslation();

	return (
		<main className="mx-auto max-w-5xl px-4 py-8 sm:py-12 max-sm:px-3 max-sm:py-6">
			<header className="mb-6 sm:mb-10">
				<h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
					{t("新闻资讯")}
				</h1>
				<p className="mt-1 text-sm text-muted-foreground sm:mt-2">
					{t("共 {total} 篇", { total })}
				</p>
			</header>

			{records.length === 0 ? (
				<div className="py-20 text-center text-sm text-muted-foreground">
					{t("暂无新闻")}
				</div>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
					{records.map((item: NewsRecord) => (
						<Link key={item.id} to="/news/$slug" params={{ slug: item.slug }}>
							<Card className="h-full transition-all hover:shadow-md hover:border-primary/30">
								<CardHeader className="p-4 sm:p-6">
									<div className="flex items-start justify-between gap-2">
										<CardTitle className="line-clamp-2 text-base sm:text-lg">
											{item.title}
										</CardTitle>
										{item.isPinned && (
											<Badge variant="secondary" className="shrink-0 text-xs">
												{t("置顶")}
											</Badge>
										)}
									</div>
									{item.description && (
										<CardDescription className="line-clamp-3 text-xs sm:text-sm">
											{item.description}
										</CardDescription>
									)}
								</CardHeader>
								<CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
									<time className="text-xs text-muted-foreground">
										{item.publishedAt
											? formatDate(item.publishedAt, locale)
											: ""}
									</time>
								</CardContent>
							</Card>
						</Link>
					))}
				</div>
			)}

			{totalPages > 1 && (
				<nav className="mt-8 flex flex-wrap items-center justify-center gap-1.5 sm:mt-10 sm:gap-2">
					{Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
						<Link
							key={p}
							to="/news"
							className={`min-w-[2rem] rounded-md border px-2.5 py-1.5 text-center text-sm transition-colors sm:px-3 ${
								p === page
									? "border-primary bg-primary text-primary-foreground"
									: "border-border text-foreground hover:bg-accent"
							}`}
						>
							{p}
						</Link>
					))}
				</nav>
			)}
		</main>
	);
}
