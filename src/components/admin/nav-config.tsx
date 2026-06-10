/**
 * 管理端侧边栏导航配置
 */
import {
	AppstoreOutlined,
	BookOutlined,
	DashboardOutlined,
	ExperimentOutlined,
	FileTextOutlined,
	FolderOpenOutlined,
	GlobalOutlined,
	ReadOutlined,
	RobotOutlined,
	SafetyOutlined,
	SettingOutlined,
	TeamOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";

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

export const NAV_GROUPS: NavGroup[] = [
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
			{
				key: "/admin/roles",
				label: "角色管理",
				icon: <AppstoreOutlined />,
			},
		],
	},
	{
		label: "系统管理",
		items: [
			{ key: "/admin/dicts", label: "字典管理", icon: <BookOutlined /> },
			{
				key: "/admin/config",
				label: "系统配置",
				icon: <SettingOutlined />,
			},
			{
				key: "/admin/files",
				label: "文件管理",
				icon: <FolderOpenOutlined />,
			},
			{
				key: "/admin/logs",
				label: "日志查询",
				icon: <FileTextOutlined />,
			},
			{
				key: "/admin/translations/ui",
				label: "UI 翻译",
				icon: <GlobalOutlined />,
			},
			{
				key: "/admin/translations/content",
				label: "实体翻译",
				icon: <GlobalOutlined />,
			},
		],
	},
	{
		label: "测试页",
		items: [
			{
				key: "/admin/demo/editor",
				label: "编辑器演示",
				icon: <ExperimentOutlined />,
			},
			{
				key: "/admin/demo/ai",
				label: "AI 测试",
				icon: <RobotOutlined />,
			},
		],
	},
];
