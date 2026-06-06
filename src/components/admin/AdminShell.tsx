/**
 * 管理端布局 Shell：侧边导航 + 顶部栏 + 内容区
 */

import {
	BookOpen,
	ChevronLeft,
	FileText,
	FolderOpen,
	LayoutDashboard,
	LogOut,
	Menu,
	Newspaper,
	Settings,
	ShieldCheck,
	Users,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { logout } from "#/routes/admin/_admin";

/** 导航菜单项 */
interface NavItem {
	label: string;
	href: string;
	icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
	{ label: "仪表盘", href: "/admin", icon: <LayoutDashboard size={18} /> },
	{ label: "新闻管理", href: "/admin/news", icon: <Newspaper size={18} /> },
	{
		label: "管理员",
		href: "/admin/users/admins",
		icon: <ShieldCheck size={18} />,
	},
	{
		label: "客户端用户",
		href: "/admin/users/clients",
		icon: <Users size={18} />,
	},
	{ label: "角色管理", href: "/admin/roles", icon: <ShieldCheck size={18} /> },
	{ label: "字典管理", href: "/admin/dicts", icon: <BookOpen size={18} /> },
	{ label: "系统配置", href: "/admin/config", icon: <Settings size={18} /> },
	{ label: "文件管理", href: "/admin/files", icon: <FolderOpen size={18} /> },
	{ label: "日志查询", href: "/admin/logs", icon: <FileText size={18} /> },
];

export function AdminShell({ children }: { children: ReactNode }) {
	const [collapsed, setCollapsed] = useState(false);

	const handleLogout = async () => {
		await logout();
		window.location.href = "/admin/login";
	};

	return (
		<div className="flex h-screen bg-zinc-50">
			{/* 侧边栏 */}
			<aside
				className={`flex flex-col border-r border-zinc-200 bg-white transition-all duration-200 ${
					collapsed ? "w-16" : "w-56"
				}`}
			>
				{/* Logo 区域 */}
				<div className="flex h-14 items-center justify-between border-b border-zinc-200 px-4">
					{!collapsed && (
						<span className="text-sm font-bold text-zinc-900">CMS 管理</span>
					)}
					<button
						type="button"
						onClick={() => setCollapsed(!collapsed)}
						className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
					>
						{collapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
					</button>
				</div>

				{/* 导航 */}
				<nav className="flex-1 overflow-y-auto px-2 py-3">
					{NAV_ITEMS.map((item) => (
						<a
							key={item.href}
							href={item.href}
							className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 ${
								collapsed ? "justify-center" : ""
							}`}
							title={collapsed ? item.label : undefined}
						>
							{item.icon}
							{!collapsed && <span>{item.label}</span>}
						</a>
					))}
				</nav>

				{/* 底部退出 */}
				<div className="border-t border-zinc-200 px-2 py-3">
					<button
						type="button"
						onClick={handleLogout}
						className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-500 hover:bg-red-50 hover:text-red-600 ${
							collapsed ? "justify-center" : ""
						}`}
						title={collapsed ? "退出登录" : undefined}
					>
						<LogOut size={18} />
						{!collapsed && <span>退出登录</span>}
					</button>
				</div>
			</aside>

			{/* 主内容区 */}
			<main className="flex-1 overflow-auto">
				<div className="p-6">{children}</div>
			</main>
		</div>
	);
}
