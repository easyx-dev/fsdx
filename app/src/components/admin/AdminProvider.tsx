/**
 * 管理端提供器
 */
import { StyleProvider } from "@ant-design/cssinjs";
import { useThemeMode } from "@fsdx/ui-ssr/use-theme-mode";
import { useLocation } from "@tanstack/react-router";
import { App, theme as antdTheme, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { useMemo } from "react";
import { AdminLayout, AdminThemeContext } from "#/components/admin/AdminLayout";
import { AntdStaticBridge } from "#/components/antd-static";
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
		<StyleProvider layer>
			<AdminThemeContext.Provider value={ctxValue}>
				<ConfigProvider
					locale={zhCN}
					theme={{
						token: { colorPrimary: "#00b96b", borderRadius: 4 },
						algorithm: isDark
							? antdTheme.darkAlgorithm
							: antdTheme.defaultAlgorithm,
					}}
				>
					<App message={{ duration: 5 }} notification={{ duration: 5 }}>
						<AntdStaticBridge />
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
		</StyleProvider>
	);
}
