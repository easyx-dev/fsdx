/**
 * 管理端提供器
 */
import { useLocation } from "@tanstack/react-router";
import { App, theme as antdTheme, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { useMemo } from "react";
import { AdminLayout, AdminThemeContext } from "#/components/admin/AdminLayout";
import { useThemeMode } from "#/hooks/use-theme-mode";
import { AdminAuthProvider } from "./AdminAuthProvider";

export function AdminProvider({ children }: { children: React.ReactNode }) {
	const location = useLocation();
	const pathname = location.pathname;
	const isStandalone =
		pathname === "/admin/login" ||
		pathname === "/admin/init" ||
		pathname === "/admin/forgot-password";
	const isAdmin = pathname.startsWith("/admin");

	const { mode, setMode, isDark } = useThemeMode("admin-theme");

	const ctxValue = useMemo(
		() => ({ mode, setMode, isDark }),
		[mode, setMode, isDark],
	);

	return (
		<AdminThemeContext.Provider value={ctxValue}>
			<ConfigProvider
				locale={zhCN}
				theme={{
					algorithm: isDark
						? antdTheme.darkAlgorithm
						: antdTheme.defaultAlgorithm,
				}}
			>
				<App>
					{!isStandalone && isAdmin ? (
						<AdminAuthProvider>
							<AdminLayout>{children}</AdminLayout>
						</AdminAuthProvider>
					) : (
						children
					)}
				</App>
			</ConfigProvider>
		</AdminThemeContext.Provider>
	);
}
