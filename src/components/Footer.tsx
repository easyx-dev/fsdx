/**
 * 前台公共 Footer（SSR 端 shadcn/ui）
 * 导航链接通过 useTranslation 国际化
 */
import { Link } from "@tanstack/react-router";
import { useTranslation } from "#/lib/i18n/i18n-context";

export default function Footer() {
	const year = new Date().getFullYear();
	const { t } = useTranslation();

	return (
		<footer className="border-t border-border px-4 py-8 sm:py-10">
			<div className="mx-auto max-w-5xl">
				<div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between sm:gap-4">
					<div className="flex items-center gap-2 text-sm font-medium text-foreground">
						<span className="flex h-5 w-5 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
							C
						</span>
						CMS
					</div>
					<nav className="flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground sm:gap-4">
						<Link to="/" className="hover:text-foreground">
							{t("首页")}
						</Link>
						<Link to="/news" className="hover:text-foreground">
							{t("新闻")}
						</Link>
						<Link to="/about" className="hover:text-foreground">
							{t("关于")}
						</Link>
					</nav>
					<p className="text-xs text-muted-foreground sm:text-sm">
						&copy; {year} CMS. All rights reserved.
					</p>
				</div>
			</div>
		</footer>
	);
}
