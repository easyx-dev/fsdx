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
import { ADMIN_SIDE } from "#/theme/themes";
import { AdminAuthProvider } from "./AdminAuthProvider";

export function AdminProvider({ children }: { children: React.ReactNode }) {
	const location = useLocation();
	const pathname = location.pathname;
	const isStandalone =
		pathname === "/admin/login" ||
		pathname === "/admin/init" ||
		pathname === "/admin/forgot-password";
	const isAdmin = pathname.startsWith("/admin");

	const { mode, setMode, familyId, setFamilyId, isDark, scheme } =
		useThemeMode(ADMIN_SIDE);

	const ctxValue = useMemo(
		() => ({ mode, setMode, familyId, setFamilyId, isDark }),
		[mode, setMode, familyId, setFamilyId, isDark],
	);

	return (
		<StyleProvider layer>
			<AdminThemeContext.Provider value={ctxValue}>
				<ConfigProvider
					locale={zhCN}
					theme={{
						token: {
							// 品牌主色：随主题家族切换（棕/蓝灰/绿，见主题注册表）
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
