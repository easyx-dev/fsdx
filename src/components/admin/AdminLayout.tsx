/**
 * 管理端布局：antd Layout + Sider + Menu
 * 集成三态主题切换（light / dark / auto）与 antd ConfigProvider 联动
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
import {
	theme as antdTheme,
	ConfigProvider,
	Layout,
	Menu,
	message,
	notification,
} from "antd";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";
import { logout } from "#/routes/admin/_admin";

const { Sider, Content, Header } = Layout;

/** 主题模式 */
export type ThemeMode = "light" | "dark" | "auto";

/** Admin 主题 Context */
interface AdminThemeContextType {
	mode: ThemeMode;
	setMode: (mode: ThemeMode) => void;
}

const AdminThemeContext = createContext<AdminThemeContextType | undefined>(
	undefined,
);

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

const NAV_ITEMS: NavItem[] = [
	{ key: "/admin", label: "仪表盘", icon: <DashboardOutlined /> },
	{ key: "/admin/news", label: "新闻管理", icon: <ReadOutlined /> },
	{ key: "/admin/users/admins", label: "管理员", icon: <SafetyOutlined /> },
	{ key: "/admin/users/clients", label: "客户端用户", icon: <TeamOutlined /> },
	{ key: "/admin/roles", label: "角色管理", icon: <AppstoreOutlined /> },
	{ key: "/admin/dicts", label: "字典管理", icon: <BookOutlined /> },
	{ key: "/admin/config", label: "系统配置", icon: <SettingOutlined /> },
	{ key: "/admin/files", label: "文件管理", icon: <FolderOpenOutlined /> },
	{ key: "/admin/logs", label: "日志查询", icon: <FileTextOutlined /> },
];

/** 从 localStorage 读取保存的主题模式 */
function getStoredMode(): ThemeMode {
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
function resolveIsDark(mode: ThemeMode): boolean {
	if (mode === "dark") return true;
	if (mode === "light") return false;
	if (typeof window !== "undefined") {
		return window.matchMedia("(prefers-color-scheme: dark)").matches;
	}
	return false;
}

export function AdminLayout({ children }: { children: ReactNode }) {
	const [collapsed, setCollapsed] = useState(false);
	const [mode, setMode] = useState<ThemeMode>("auto");
	// 初始化主题模式
	useEffect(() => {
		setMode(getStoredMode());
	}, []);

	// 持久化主题模式
	const handleSetMode = useCallback((newMode: ThemeMode) => {
		setMode(newMode);
		try {
			localStorage.setItem("admin-theme", newMode);
		} catch {
			/* ignore */
		}
	}, []);

	// 监听系统主题变化（auto 模式时）
	useEffect(() => {
		if (mode !== "auto") return;
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const handler = () => setMode("auto"); // 触发 re-render 来更新 resolve 结果
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, [mode]);

	const isDark = useMemo(() => resolveIsDark(mode), [mode]);

	const ctxValue = useMemo(
		() => ({ mode, setMode: handleSetMode }),
		[mode, handleSetMode],
	);

	const handleLogout = async () => {
		await logout();
		window.location.href = "/admin/login";
	};

	// 获取当前路径作为菜单选中项
	const currentPath =
		typeof window !== "undefined" ? window.location.pathname : "/admin";

	// 设置全局 message / notification 默认 duration 为 5s
	useEffect(() => {
		message.config({ duration: 5 });
		notification.config({ duration: 5 });
	}, []);

	return (
		<AdminThemeContext.Provider value={ctxValue}>
			<ConfigProvider
				theme={{
					algorithm: isDark
						? antdTheme.darkAlgorithm
						: antdTheme.defaultAlgorithm,
				}}
			>
				<Layout className="h-screen">
					<Sider
						trigger={null}
						collapsible
						collapsed={collapsed}
						theme={isDark ? "dark" : "light"}
						className="border-r border-border"
					>
						{/* Logo */}
						<div className="flex h-16 items-center justify-center border-b border-border">
							<span className="text-lg font-bold text-primary">
								{collapsed ? "CMS" : "CMS 管理后台"}
							</span>
						</div>

						{/* 导航菜单 */}
						<Menu
							theme={isDark ? "dark" : "light"}
							mode="inline"
							selectedKeys={[currentPath]}
							items={NAV_ITEMS.map((item) => ({
								key: item.key,
								icon: item.icon,
								label: (
									<a href={item.key} className="no-underline">
										{item.label}
									</a>
								),
							}))}
							className="flex-1 border-r-0"
						/>

						{/* 底部操作区 */}
						<div className="border-t border-border px-2 py-3">
							{/* 主题切换 */}
							<div className="mb-2 flex items-center justify-center gap-1">
								{(["light", "dark", "auto"] as ThemeMode[]).map((m) => (
									<button
										type="button"
										key={m}
										onClick={() => handleSetMode(m)}
										className={`rounded px-2 py-1 text-xs transition-colors ${
											m === mode
												? "bg-primary text-primary-foreground"
												: "text-muted-foreground hover:bg-accent"
										}`}
									>
										{m === "light" ? "亮" : m === "dark" ? "暗" : "自动"}
									</button>
								))}
							</div>
							<button
								type="button"
								onClick={handleLogout}
								className="flex w-full items-center justify-center gap-2 rounded p-2 text-sm text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500"
							>
								<LogoutOutlined />
								{!collapsed && <span>退出登录</span>}
							</button>
						</div>
					</Sider>

					{/* 主内容区 */}
					<Layout>
						<Header className="flex items-center bg-background px-4">
							<button
								type="button"
								onClick={() => setCollapsed(!collapsed)}
								className="rounded p-1 text-base text-foreground hover:bg-accent"
							>
								{collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
							</button>
						</Header>
						<Content className="overflow-auto p-6">{children}</Content>
					</Layout>
				</Layout>
			</ConfigProvider>
		</AdminThemeContext.Provider>
	);
}
