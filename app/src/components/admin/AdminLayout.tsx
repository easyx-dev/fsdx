/**
 * 管理端布局：纯 Tailwind 侧边栏 + 内容区
 * 顶栏由 AdminPageContent 组件在每个页面中提供
 */
import {
	BellOutlined,
	EditOutlined,
	LogoutOutlined,
	MenuFoldOutlined,
	MenuUnfoldOutlined,
	MoonOutlined,
	SunOutlined,
} from "@ant-design/icons";
import type { ThemeMode } from "@fsdx/ui-ssr/use-theme-mode";
import { Link, useLocation } from "@tanstack/react-router";
import {
	Avatar,
	Badge,
	Button,
	Divider,
	Flex,
	Popover,
	Segmented,
	Tooltip,
} from "antd";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { useAdminAuth } from "#/components/admin/AdminAuthProvider";
import { NAV_GROUPS } from "#/components/admin/NavConfig";
import { useAdminConfigStore } from "#/components/global-store/admin-config-store";
import { useAdminDictStore } from "#/components/global-store/admin-dict-store";
import { Logo } from "#/components/Logo";
import { logoutSFn } from "#/services/admin-auth/admin-auth.functions";
import { getAdminUnreadCountSFn } from "#/services/message/message.functions";
import { ADMIN_SIDE } from "#/theme/themes";

/** Admin 主题 Context */
interface AdminThemeContextType {
	mode: ThemeMode;
	setMode: (mode: ThemeMode) => void;
	/** 当前主题家族 id（棕/蓝灰/绿） */
	familyId: string;
	setFamilyId: (familyId: string) => void;
	/** 当前是否为暗色模式（水合完成前为 false） */
	isDark: boolean;
}

export const AdminThemeContext = createContext<
	AdminThemeContextType | undefined
>(undefined);

export function useAdminTheme(): AdminThemeContextType {
	const ctx = useContext(AdminThemeContext);
	if (!ctx) throw new Error("useAdminTheme 必须在 AdminLayout 内部使用");
	return ctx;
}

/** 判断当前路径是否匹配菜单项 */
function isActive(itemKey: string, currentPath: string): boolean {
	if (itemKey === "/admin") return currentPath === "/admin";
	return currentPath === itemKey || currentPath.startsWith(`${itemKey}/`);
}

export function AdminLayout({ children }: { children: ReactNode }) {
	const [collapsed, setCollapsed] = useState(false);
	const { mode, setMode, familyId, setFamilyId, isDark } = useAdminTheme();
	const { user } = useAdminAuth();
	const location = useLocation();
	const currentPath = location.pathname;

	/** 未读消息数（30 秒轮询） */
	const [unreadCount, setUnreadCount] = useState(0);

	/** 拉取未读消息数 */
	const fetchUnreadCount = useCallback(async () => {
		if (!user) return;
		try {
			setUnreadCount(await getAdminUnreadCountSFn());
		} catch {
			// 未读数为辅助信息，失败不打扰用户
		}
	}, [user]);

	useEffect(() => {
		if (!user) {
			setUnreadCount(0);
			return;
		}
		fetchUnreadCount();
		const timer = setInterval(fetchUnreadCount, 30000);
		return () => clearInterval(timer);
	}, [user, fetchUnreadCount]);

	const handleLogout = async () => {
		await logoutSFn();
		window.location.href = "/admin/login";
	};

	// 进入 admin 时一次性加载全部字典到 zustand store
	useEffect(() => {
		useAdminDictStore.getState().loadAll();
	}, []);

	// 加载客户端可见系统配置到 zustand store
	useEffect(() => {
		useAdminConfigStore.getState().loadAll();
	}, []);

	const siteName = useAdminConfigStore((s) => s.config.site_name) || "FSDX";

	// 更新管理端页面标题
	useEffect(() => {
		document.title = `${siteName} 管理后台`;
	}, [siteName]);

	return (
		<div className="flex h-screen overflow-hidden bg-background">
			{/* 侧边栏 */}
			<aside
				className={`flex flex-col border-r border-border bg-sidebar transition-all duration-300 ${
					collapsed ? "w-16" : "w-50"
				}`}
			>
				{/* Logo 区域 */}
				<div className="flex h-14 shrink-0 items-center border-b border-border px-3 overflow-hidden">
					<Logo type="admin" height={36} />
					{!collapsed && (
						<span className="ml-2 text-sm font-semibold text-sidebar-primary whitespace-nowrap">
							{siteName}
						</span>
					)}
				</div>

				{/* 导航菜单 */}
				<nav className="flex-1 overflow-y-auto overflow-x-hidden py-2">
					{NAV_GROUPS.map((group) => (
						<div key={group.label} className="mb-1">
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
										className={`mx-2 my-0.5 flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
											active
												? "bg-sidebar-accent text-sidebar-primary font-medium border-l-[3px] border-l-sidebar-primary"
												: "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground border-l-[3px] border-l-transparent"
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
					{/* Row 1: 折叠 + 主题切换（纯图标） */}
					<div
						className={`mb-2 flex items-center gap-1 ${collapsed ? "flex-col" : "justify-center"}`}
					>
						<Tooltip title={collapsed ? "展开侧边栏" : "收起侧边栏"}>
							<Button
								type="text"
								onClick={() => setCollapsed(!collapsed)}
								icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
							/>
						</Tooltip>
						{/* 主题设置：配色家族 + 明暗模式 */}
						<Popover
							trigger="click"
							placement="rightBottom"
							content={
								<div className="w-64 space-y-4">
									<div>
										<div className="mb-2 text-xs font-semibold text-muted-foreground">
											主题配色
										</div>
										<div className="flex gap-2">
											{ADMIN_SIDE.families.map((f) => {
												const active = f.id === familyId;
												return (
													<button
														key={f.id}
														type="button"
														title={f.label}
														onClick={() => setFamilyId(f.id)}
														className={`flex h-8 flex-1 items-center justify-center rounded border text-xs transition-colors ${
															active
																? "border-primary bg-primary-bg font-medium text-primary"
																: "border-border text-muted-foreground hover:bg-accent"
														}`}
													>
														{f.label}
													</button>
												);
											})}
										</div>
									</div>
									<div>
										<div className="mb-2 text-xs font-semibold text-muted-foreground">
											明暗模式
										</div>
										<Segmented
											block
											value={mode}
											onChange={(value) => setMode(value as ThemeMode)}
											options={[
												{ label: "亮色", value: "light" },
												{ label: "暗色", value: "dark" },
												{ label: "跟随系统", value: "auto" },
											]}
										/>
									</div>
								</div>
							}
						>
							<Button
								type="text"
								icon={isDark ? <MoonOutlined /> : <SunOutlined />}
							/>
						</Popover>
						{/* 消息中心铃铛（未读角标 + 跳转） */}
						<Tooltip title="我的消息">
							<Badge count={unreadCount} size="small">
								<Link to="/admin/messages">
									<Button type="text" icon={<BellOutlined />} />
								</Link>
							</Badge>
						</Tooltip>
					</div>

					{/* Row 2: 用户块（hover Popover） */}
					{user && (
						<Popover
							trigger="hover"
							placement="rightBottom"
							content={
								<div className="w-56">
									{/* 用户信息卡片 */}
									<div className="flex items-center gap-3 pb-1">
										<Avatar
											src={user.avatar ?? undefined}
											size="large"
											shape="square"
										>
											{user.username.charAt(0).toUpperCase()}
										</Avatar>
										<div className="min-w-0 flex-1">
											<div className="truncate text-sm font-medium">
												{user.username}
											</div>
											<div className="truncate text-xs text-muted-foreground">
												{user.email}
											</div>
										</div>
									</div>
									<Divider size="small" />
									{/* 退出登录 */}
									<Flex justify="space-between" align="center">
										<Button type="link">
											<EditOutlined />
											修改资料
										</Button>
										<Divider size="small" vertical />
										<Button type="link" onClick={handleLogout} danger>
											<LogoutOutlined />
											退出登录
										</Button>
									</Flex>
								</div>
							}
						>
							{/* 触发区 */}
							<div
								className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-sidebar-accent ${
									collapsed ? "justify-center" : ""
								}`}
							>
								<Avatar
									src={user.avatar ?? undefined}
									size="large"
									shape="square"
								>
									{user.username.charAt(0).toUpperCase()}
								</Avatar>
								{!collapsed && (
									<div className="min-w-0 flex-1 text-left">
										<div className="truncate text-sm font-medium text-sidebar-foreground">
											{user.username}
										</div>
										<div className="truncate text-xs text-muted-foreground">
											{user.isRoot
												? "超级管理员"
												: (user.roleNames?.length ?? 0) > 0
													? (user.roleNames ?? []).join("、")
													: "管理员"}
										</div>
									</div>
								)}
							</div>
						</Popover>
					)}
				</div>
			</aside>

			{/* 主内容区 — 顶栏由 AdminPageContent 在各页面中提供 */}
			<main className="flex flex-1 flex-col overflow-hidden">{children}</main>
		</div>
	);
}
