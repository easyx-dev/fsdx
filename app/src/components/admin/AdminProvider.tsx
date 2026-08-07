/**
 * 管理端提供器
 */
import { StyleProvider } from "@ant-design/cssinjs";
import { AntdStaticBridge } from "@fsdx/ui-spa/antd-static";
import { useThemeMode } from "@fsdx/ui-ssr/use-theme-mode";
import { useLocation } from "@tanstack/react-router";
import { App, theme as antdTheme, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { useMemo } from "react";
import { AdminLayout, AdminThemeContext } from "#/components/admin/AdminLayout";
import { ADMIN_THEME } from "#/theme/themes";
import { AdminAuthProvider } from "./AdminAuthProvider";

export function AdminProvider({ children }: { children: React.ReactNode }) {
	const location = useLocation();
	const pathname = location.pathname;
	const isStandalone =
		pathname === "/admin/login" ||
		pathname === "/admin/init" ||
		pathname === "/admin/forgot-password";
	const isAdmin = pathname.startsWith("/admin");

	const { mode, setMode, isDark, scheme } = useThemeMode(ADMIN_THEME);

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
						token: {
							// 品牌主色：随明暗切换（棕亮/棕暗，见主题注册表）
							colorPrimary: scheme.antdColorPrimary,
							colorInfo: scheme.antdColorPrimary,
							// 直角风格：antd 6 borderRadius 归零，派生圆角自动归零
							borderRadius: 0,
						},
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
