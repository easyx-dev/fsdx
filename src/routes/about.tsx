/**
 * 关于页面
 */
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { useTranslation } from "#/lib/i18n/i18n-context";

export const Route = createFileRoute("/about")({
	component: About,
});

function About() {
	const { t } = useTranslation();

	return (
		<main className="mx-auto max-w-3xl px-4 py-8 sm:py-16">
			<Card>
				<CardHeader className="p-4 sm:p-6">
					<CardTitle className="text-xl sm:text-2xl">{t("关于 CMS")}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4 p-4 pt-0 sm:space-y-6 sm:p-6 sm:pt-0">
					<p className="text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
						{t(
							"CMS 内容管理系统是一个基于 TanStack Start 构建的全栈内容管理平台。支持类型安全路由、Server Functions、SSR 流式渲染，并配备强大的管理后台。",
						)}
					</p>
					<div className="grid gap-4 sm:grid-cols-2">
						<Card>
							<CardHeader className="p-4 sm:p-5">
								<CardTitle className="text-sm sm:text-base">
									{t("技术栈")}
								</CardTitle>
							</CardHeader>
							<CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
								<ul className="space-y-1 text-xs text-muted-foreground sm:text-sm">
									<li>TanStack Start (SSR)</li>
									<li>React 19 + TypeScript</li>
									<li>antd v6 管理后台</li>
									<li>Tailwind CSS + shadcn/ui</li>
									<li>PostgreSQL + Drizzle ORM</li>
								</ul>
							</CardContent>
						</Card>
						<Card>
							<CardHeader className="p-4 sm:p-5">
								<CardTitle className="text-sm sm:text-base">
									{t("核心功能")}
								</CardTitle>
							</CardHeader>
							<CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
								<ul className="space-y-1 text-xs text-muted-foreground sm:text-sm">
									<li>{t("新闻发布与管理")}</li>
									<li>{t("RBAC 权限控制")}</li>
									<li>{t("字典与系统配置")}</li>
									<li>{t("文件上传管理")}</li>
									<li>{t("日志查询分析")}</li>
								</ul>
							</CardContent>
						</Card>
					</div>
				</CardContent>
			</Card>
		</main>
	);
}
