/**
 * 前台公共 Header（SSR 端 shadcn/ui，移动优先）
 */
import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import ThemeToggle from "./ThemeToggle";

const NAV_LINKS = [
	{ to: "/", label: "首页" },
	{ to: "/news", label: "新闻" },
	{ to: "/about", label: "关于" },
] as const;

export default function Header() {
	const [mobileOpen, setMobileOpen] = useState(false);

	return (
		<header className="sticky top-0 z-50 border-b border-border bg-background/80 px-4 backdrop-blur-lg">
			<nav className="mx-auto flex max-w-5xl items-center justify-between py-3">
				{/* Logo */}
				<Link
					to="/"
					className="flex shrink-0 items-center gap-2 text-base font-semibold text-foreground no-underline"
				>
					<span className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
						C
					</span>
					<span className="hidden sm:inline">CMS</span>
				</Link>

				{/* 桌面端导航 */}
				<div className="hidden items-center gap-1 text-sm font-medium sm:flex sm:gap-4">
					{NAV_LINKS.map((link) => (
						<Link
							key={link.to}
							to={link.to}
							className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:text-foreground sm:px-3"
							activeProps={{ className: "text-foreground bg-accent" }}
						>
							{link.label}
						</Link>
					))}
				</div>

				{/* 右侧操作区 */}
				<div className="flex items-center gap-1 sm:gap-2">
					<Link to="/login" className="hidden sm:block">
						<Button variant="ghost" size="sm">
							登录
						</Button>
					</Link>
					<ThemeToggle />
					{/* 移动端菜单按钮 */}
					<Button
						variant="ghost"
						size="icon"
						className="sm:hidden"
						onClick={() => setMobileOpen(!mobileOpen)}
						aria-label="切换菜单"
					>
						{mobileOpen ? <X /> : <Menu />}
					</Button>
				</div>
			</nav>

			{/* 移动端下拉菜单 */}
			{mobileOpen && (
				<div className="border-t border-border pb-3 pt-2 sm:hidden">
					{NAV_LINKS.map((link) => (
						<Link
							key={link.to}
							to={link.to}
							className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
							activeProps={{ className: "bg-accent text-foreground" }}
							onClick={() => setMobileOpen(false)}
						>
							{link.label}
						</Link>
					))}
					<div className="mt-1 border-t border-border pt-1">
						<Link
							to="/login"
							className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
							onClick={() => setMobileOpen(false)}
						>
							登录
						</Link>
					</div>
				</div>
			)}
		</header>
	);
}
