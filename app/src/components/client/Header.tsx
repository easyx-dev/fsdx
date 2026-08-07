/**
 * 前台公共 Header（SSR 端 shadcn/ui，移动优先）
 * 集成国际化：语言切换按钮，中文作为翻译 key
 * 根据客户端登录状态显示用户名/退出或登录链接
 */

import { ThemeToggle } from "@fsdx/ui-ssr/theme";
import { Button } from "@fsdx/ui-ssr/ui";
import { ClientOnly, Link } from "@tanstack/react-router";
import { Bell, LogOut, Menu, User, X } from "lucide-react";
import { useState } from "react";
import { useClientAuth, ClientLogo } from "#/components/client";
import { useGlobalStore, useTranslation } from "#/components/providers";
import { track } from "#/lib/track/track";
import { CLIENT_THEME } from "#/theme/themes";

export function Header() {
	const [mobileOpen, setMobileOpen] = useState(false);
	const { t, locale } = useTranslation();
	const { user, logout } = useClientAuth();
	const { systemConfig } = useGlobalStore();
	const siteName = systemConfig?.site_name || "FSDX";

	const NAV_LINKS = [
		{ to: "/", label: t("首页") },
		{ to: "/news", label: t("新闻") },
		{ to: "/about", label: t("关于") },
	] as const;

	const handleLogout = async () => {
		track("Logout", {});
		await logout();
		setMobileOpen(false);
	};

	return (
		<header className="sticky top-0 z-50 border-b border-border bg-background/80 px-4 backdrop-blur-lg">
			<nav className="mx-auto flex max-w-5xl items-center justify-between py-3">
				{/* Logo */}
				<Link to="/" className="flex shrink-0 items-center gap-2 no-underline">
					<ClientLogo height={32} />
					<span className="text-base font-semibold text-foreground">
						{siteName}
					</span>
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
					{/* 语言切换按钮 */}
					<ClientOnly>
						<Button
							variant="ghost"
							size="sm"
							onClick={async () => {
								const l = await cookieStore.get("lang");
								await cookieStore.set("lang", l?.value === "zh" ? "en" : "zh");
								window.location.reload();
							}}
							title={t("切换语言")}
							className="text-xs uppercase"
						>
							{locale === "zh" ? "EN" : "中文"}
						</Button>
					</ClientOnly>
					{/* 桌面端用户区 */}
					{user ? (
						<div className="hidden items-center gap-2 sm:flex">
							<Link
								to="/messages"
								className="relative rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
								aria-label={t("消息中心")}
							>
								<Bell className="h-4 w-4" />
							</Link>
							<span className="flex items-center gap-1 text-sm text-muted-foreground">
								<User className="h-4 w-4" />
								{user.username}
							</span>
							<Button
								variant="ghost"
								size="sm"
								onClick={handleLogout}
								aria-label={t("退出登录")}
							>
								<LogOut className="h-4 w-4" />
							</Button>
						</div>
					) : (
						<Link to="/login" className="hidden sm:block">
							<Button variant="ghost" size="sm">
								{t("登录")}
							</Button>
						</Link>
					)}
					<ThemeToggle preset={CLIENT_THEME} />
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
						{user ? (
							<>
								<div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
									<User className="h-4 w-4" />
									{user.username}
								</div>
								<button
									type="button"
									className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
									onClick={handleLogout}
								>
									<LogOut className="h-4 w-4" />
									{t("退出登录")}
								</button>
							</>
						) : (
							<Link
								to="/login"
								className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
								onClick={() => setMobileOpen(false)}
							>
								{t("登录")}
							</Link>
						)}
					</div>
				</div>
			)}
		</header>
	);
}
