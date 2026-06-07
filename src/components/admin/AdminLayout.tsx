/**
 * 管理端布局：纯 Tailwind 侧边栏 + 顶栏 + 内容区
 * 不依赖 antd Layout 组件
 */
import {
	AppstoreOutlined,
	BookOutlined,
	DashboardOutlined,
	FileTextOutlined,
	FolderOpenOutlined,
	LogoutOutlined,
	MenuFoldOutlined,
	MenuUnfoldOutlined,
	ReadOutlined,
	SafetyOutlined,
	SettingOutlined,
	TeamOutlined,
} from "@ant-design/icons";
import { Link, useLocation } from "@tanstack/react-router";
import { message, notification } from "antd";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";
import { logout } from "#/routes/admin/_admin";

/** 主题模式 */
export type ThemeMode = "light" | "dark" | "auto";

/** Admin 主题 Context */
interface AdminThemeContextType {
	mode: ThemeMode;
	setMode: (mode: ThemeMode) => void;
}

export const AdminThemeContext = createContext<
	AdminThemeContextType | undefined
>(undefined);

export function useAdminTheme(): AdminThemeContextType {
	const ctx = useContext(AdminThemeContext);
	if (!ctx) throw new Error("useAdminTheme 必须在 AdminLayout 内部使用");
	return ctx;
}

/** 导航菜单项 */
interface NavItem {
	key: string;
	label: string;
	icon: ReactNode;
}

/** 导航分组 */
interface NavGroup {
	label: string;
	items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
	{
		label: "概览",
		items: [{ key: "/admin", label: "仪表盘", icon: <DashboardOutlined /> }],
	},
	{
		label: "内容管理",
		items: [{ key: "/admin/news", label: "新闻管理", icon: <ReadOutlined /> }],
	},
	{
		label: "用户管理",
		items: [
			{
				key: "/admin/users/admins",
				label: "管理员",
				icon: <SafetyOutlined />,
			},
			{
				key: "/admin/users/clients",
				label: "客户端用户",
				icon: <TeamOutlined />,
			},
		],
	},
	{
		label: "权限管理",
		items: [
			{ key: "/admin/roles", label: "角色管理", icon: <AppstoreOutlined /> },
		],
	},
	{
		label: "系统设置",
		items: [
			{ key: "/admin/dicts", label: "字典管理", icon: <BookOutlined /> },
			{ key: "/admin/config", label: "系统配置", icon: <SettingOutlined /> },
			{
				key: "/admin/files",
				label: "文件管理",
				icon: <FolderOpenOutlined />,
			},
			{ key: "/admin/logs", label: "日志查询", icon: <FileTextOutlined /> },
		],
	},
];

/** 从 localStorage 读取保存的主题模式 */
export function getStoredMode(): ThemeMode {
	try {
		const stored = localStorage.getItem("admin-theme");
		if (stored === "light" || stored === "dark" || stored === "auto")
			return stored;
	} catch {
		/* SSR 环境忽略 */
	}
	return "auto";
}

/** 解析实际应用的暗色模式 */
export function resolveIsDark(mode: ThemeMode): boolean {
	if (mode === "dark") return true;
	if (mode === "light") return false;
	if (typeof window !== "undefined") {
		return window.matchMedia("(prefers-color-scheme: dark)").matches;
	}
	return false;
}

/** 判断当前路径是否匹配菜单项 */
function isActive(itemKey: string, currentPath: string): boolean {
	if (itemKey === "/admin") return currentPath === "/admin";
	return currentPath.startsWith(itemKey);
}

export function AdminLayout({ children }: { children: ReactNode }) {
	const [collapsed, setCollapsed] = useState(false);
	const { mode, setMode } = useAdminTheme();
	const location = useLocation();

	const handleLogout = async () => {
		await logout();
		window.location.href = "/admin/login";
	};

	const currentPath = location.pathname;

	// 设置全局 message / notification 默认 duration 为 5s
	useEffect(() => {
		message.config({ duration: 5 });
		notification.config({ duration: 5 });
	}, []);

	return (
		<div className="flex h-screen overflow-hidden bg-background">
			{/* 侧边栏 */}
			<aside
				className={`flex flex-col border-r border-border bg-sidebar transition-all duration-300 ${
					collapsed ? "w-16" : "w-60"
				}`}
			>
				{/* Logo 区域 */}
				<div className="flex h-14 shrink-0 items-center justify-center border-b border-border px-3">
					<span className="text-base font-bold text-sidebar-primary transition-opacity">
						{collapsed ? "CMS" : "CMS 管理后台"}
					</span>
				</div>

				{/* 导航菜单 */}
				<nav className="flex-1 overflow-y-auto overflow-x-hidden py-2">
					{NAV_GROUPS.map((group) => (
						<div key={group.label} className="mb-1">
							{/* 分组标题 — 折叠时隐藏 */}
							{!collapsed && (
								<div className="px-4 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
									{group.label}
								</div>
							)}
							{group.items.map((item) => {
								const active = isActive(item.key, currentPath);
								return (
									<Link
										key={item.key}
										to={item.key}
										title={collapsed ? item.label : undefined}
										className={`mx-2 my-0.5 flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
											active
												? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
												: "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
										} ${collapsed ? "justify-center px-0" : ""}`}
									>
										<span className="flex shrink-0 items-center justify-center text-base">
											{item.icon}
										</span>
										{!collapsed && (
											<span className="truncate">{item.label}</span>
										)}
									</Link>
								);
							})}
						</div>
					))}
				</nav>

				{/* 底部操作区 */}
				<div className="shrink-0 border-t border-border px-2 py-3">
					{/* 主题切换 */}
					<div
						className={`mb-2 flex items-center gap-1 ${collapsed ? "flex-col" : "justify-center"}`}
					>
						{(["light", "dark", "auto"] as ThemeMode[]).map((m) => (
							<button
								type="button"
								key={m}
								onClick={() => setMode(m)}
								title={
									m === "light" ? "亮色" : m === "dark" ? "暗色" : "跟随系统"
								}
								className={`rounded px-2 py-1 text-xs transition-colors ${
									m === mode
										? "bg-primary text-primary-foreground"
										: "text-muted-foreground hover:bg-sidebar-accent"
								}`}
							>
								{m === "light" ? "亮" : m === "dark" ? "暗" : "自动"}
							</button>
						))}
					</div>

					{/* 退出登录 */}
					<button
						type="button"
						onClick={handleLogout}
						title={collapsed ? "退出登录" : undefined}
						className={`flex w-full items-center gap-2 rounded p-2 text-sm text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400 ${
							collapsed ? "justify-center" : ""
						}`}
					>
						<LogoutOutlined />
						{!collapsed && <span>退出登录</span>}
					</button>
				</div>
			</aside>

			{/* 主内容区 */}
			<div className="flex flex-1 flex-col overflow-hidden">
				{/* 顶栏 */}
				<header className="flex h-14 shrink-0 items-center border-b border-border bg-background px-4">
					<button
						type="button"
						onClick={() => setCollapsed(!collapsed)}
						className="rounded p-1.5 text-base text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					>
						{collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
					</button>
				</header>

				{/* 内容区 */}
				<main className="flex-1 overflow-auto p-6">{children}</main>
			</div>
		</div>
	);
}
