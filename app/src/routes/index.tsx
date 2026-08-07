/**
 * 前台首页：Hero 营销区 + 最新新闻区块
 */

import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@fsdx/ui-ssr/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "#/components/providers";
import type { NewsRecord } from "#/services/news/news.server";
import { getLatestNewsSFn } from "./index.functions";

export const Route = createFileRoute("/")({
	component: HomePage,
	loader: async () => await getLatestNewsSFn(),
	errorComponent: HomeError,
});

const features = [
	{
		label: "类型安全路由",
		desc: "TanStack Router 提供编译期路由校验，链接与参数始终同步。",
	},
	{
		label: "Server Functions",
		desc: "直接在组件中调用服务端逻辑，无需手动创建 API 层。",
	},
	{ label: "SSR 流式渲染", desc: "渐进式页面加载，首屏速度更快，SEO 友好。" },
	{
		label: "强大的管理后台",
		desc: "基于 antd 的后台管理，支持新闻、字典、配置、文件管理。",
	},
	{
		label: "RBAC 权限控制",
		desc: "细粒度角色权限，管理员与客户端用户双通道。",
	},
	{
		label: "Tailwind CSS",
		desc: "高效构建现代 UI，统一设计令牌，响应式开箱即用。",
	},
];

function HomeError({ error }: { error: unknown }) {
	const msg = error instanceof Error ? error.message : "加载失败，请稍后重试";
	return (
		<main className="mx-auto max-w-5xl px-4 py-8 sm:py-16">
			<section className="mb-12 text-center sm:mb-20">
				<h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
					CMS 内容管理系统
				</h1>
			</section>
			<section className="mb-12 grid gap-4 sm:mb-20 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
				{[
					{
						label: "类型安全路由",
						desc: "TanStack Router 提供编译期路由校验，链接与参数始终同步。",
					},
					{
						label: "Server Functions",
						desc: "直接在组件中调用服务端逻辑，无需手动创建 API 层。",
					},
					{
						label: "SSR 流式渲染",
						desc: "渐进式页面加载，首屏速度更快，SEO 友好。",
					},
					{
						label: "强大的管理后台",
						desc: "基于 antd 的后台管理，支持新闻、字典、配置、文件管理。",
					},
					{
						label: "RBAC 权限控制",
						desc: "细粒度角色权限，管理员与客户端用户双通道。",
					},
					{
						label: "Tailwind CSS",
						desc: "高效构建现代 UI，统一设计令牌，响应式开箱即用。",
					},
				].map((item) => (
					<div
						key={item.label}
						className="rounded-lg border bg-card text-card-foreground shadow-sm"
					>
						<div className="flex flex-col space-y-1.5 p-6">
							<h3 className="text-lg font-semibold leading-none tracking-tight">
								{item.label}
							</h3>
							<p className="text-sm text-muted-foreground">{item.desc}</p>
						</div>
					</div>
				))}
			</section>
			<section>
				<div className="rounded-lg border py-12 text-center">
					<p className="text-sm text-destructive">{msg}</p>
				</div>
			</section>
		</main>
	);
}

function HomePage() {
	const data = Route.useLoaderData();
	const { t, locale } = useTranslation();

	return (
		<main className="mx-auto max-w-5xl px-4 py-8 sm:py-16">
			{/* Hero 区域 */}
			<section className="mb-12 text-center sm:mb-20">
				<h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
					{t("CMS 内容管理系统")}
				</h1>
				<p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground sm:mt-4 sm:text-lg">
					{t(
						"轻量、安全、可扩展的全栈内容管理解决方案，基于 TanStack Start 构建，支持 SSR 与强大的管理后台。",
					)}
				</p>
				<div className="mt-6 flex flex-col items-center justify-center gap-3 sm:mt-8 sm:flex-row sm:gap-4">
					<Link to="/news">
						<Button className="w-full sm:w-auto">
							{t("浏览新闻")}
							<ArrowRight />
						</Button>
					</Link>
					<Link to="/about">
						<Button variant="outline" className="w-full sm:w-auto">
							{t("了解更多")}
						</Button>
					</Link>
				</div>
			</section>

			{/* 特性卡片 */}
			<section className="mb-12 grid gap-4 sm:mb-20 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
				{features.map((item) => (
					<Card key={item.label}>
						<CardHeader>
							<CardTitle>{t(item.label)}</CardTitle>
							<CardDescription>{t(item.desc)}</CardDescription>
						</CardHeader>
					</Card>
				))}
			</section>

			{/* 最新新闻 */}
			<section>
				<div className="mb-4 flex items-center justify-between sm:mb-6">
					<h2 className="text-xl font-bold text-foreground sm:text-2xl">
						{t("最新新闻")}
					</h2>
					<Link
						to="/news"
						className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
					>
						{t("查看全部")}
						<ArrowRight size={14} />
					</Link>
				</div>

				{data.records.length === 0 ? (
					<div className="rounded-lg border border-border py-12 text-center text-sm text-muted-foreground">
						{t("暂无数据")}
					</div>
				) : (
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{data.records.map((item: NewsRecord) => (
							<Link key={item.id} to="/news/$slug" params={{ slug: item.slug }}>
								<Card className="h-full transition-all hover:shadow-md hover:border-primary/30">
									<CardHeader className="p-4 sm:p-6">
										<CardTitle className="line-clamp-2 text-base sm:text-lg">
											{item.title}
										</CardTitle>
										{item.description && (
											<CardDescription className="line-clamp-2 text-xs sm:text-sm">
												{item.description}
											</CardDescription>
										)}
									</CardHeader>
									<CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
										<time className="text-xs text-muted-foreground">
											{item.publishedAt
												? dayjs(item.publishedAt).format(
														locale.startsWith("zh")
															? "YYYY年M月D日"
															: "MMMM D, YYYY",
													)
												: ""}
										</time>
									</CardContent>
								</Card>
							</Link>
						))}
					</div>
				)}
			</section>
		</main>
	);
}
