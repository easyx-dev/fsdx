/**
 * 管理端侧边栏导航配置
 */
import {
	AppstoreOutlined,
	BarChartOutlined,
	BookOutlined,
	CloudUploadOutlined,
	DashboardOutlined,
	ExperimentOutlined,
	FileTextOutlined,
	FolderOpenOutlined,
	HistoryOutlined,
	LineChartOutlined,
	MessageOutlined,
	ReadOutlined,
	RobotOutlined,
	SafetyOutlined,
	SettingOutlined,
	StockOutlined,
	TableOutlined,
	TeamOutlined,
	TranslationOutlined,
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
				key: "/admin/admin-roles",
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
				key: "/admin/file-explorer",
				label: "文件资源管理器",
				icon: <FolderOpenOutlined />,
			},
			{
				key: "/admin/messages/manage",
				label: "消息管理",
				icon: <MessageOutlined />,
			},
			{
				key: "/admin/operation-logs",
				label: "操作日志",
				icon: <HistoryOutlined />,
			},
			{
				key: "/admin/logs",
				label: "日志查询",
				icon: <FileTextOutlined />,
			},
			{
				key: "/admin/translations/ui",
				label: "UI 翻译",
				icon: <TranslationOutlined />,
			},
			{
				key: "/admin/translations/content",
				label: "实体翻译",
				icon: <TranslationOutlined />,
			},
		],
	},
	{
		label: "埋点分析",
		items: [
			{
				key: "/admin/track/query",
				label: "事件查询",
				icon: <BarChartOutlined />,
			},
			{
				key: "/admin/track/analytics",
				label: "事件分析",
				icon: <LineChartOutlined />,
			},
			{
				key: "/admin/track/event-meta",
				label: "元事件",
				icon: <TableOutlined />,
			},
			{
				key: "/admin/track/property-meta",
				label: "元属性",
				icon: <StockOutlined />,
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
			{
				key: "/admin/demo/pro-table",
				label: "ProTable 演示",
				icon: <TableOutlined />,
			},
			{
				key: "/admin/demo/upload",
				label: "上传组件演示",
				icon: <CloudUploadOutlined />,
			},
		],
	},
];
