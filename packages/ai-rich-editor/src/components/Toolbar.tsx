/**
 * 三栏编辑器顶栏：复制 / 设置
 * 高度固定，营造"工作台"式统一操作区；「设置」下拉联动分割面板显隐
 */
import { CopyOutlined, SettingOutlined } from "@ant-design/icons";
import type { MenuProps } from "antd";
import { Button, Divider, Dropdown, Switch, Typography } from "antd";
import type { AiRichNotify } from "../types";

const { Text } = Typography;

interface ToolbarProps {
	html: string;
	showChat: boolean;
	onToggleChat: () => void;
	showPreview: boolean;
	onTogglePreview: () => void;
	/** 打开设置面板 */
	onOpenSettings: () => void;
	notify?: AiRichNotify;
}

export function Toolbar({
	html,
	showChat,
	onToggleChat,
	showPreview,
	onTogglePreview,
	onOpenSettings,
	notify,
}: ToolbarProps) {
	const handleCopy = async () => {
		if (!html) {
			notify?.("warning", "暂无内容可复制");
			return;
		}
		try {
			await navigator.clipboard.writeText(html);
			notify?.("success", "已复制到剪贴板");
		} catch {
			notify?.("error", "复制失败");
		}
	};

	// 「设置」下拉：对话/预览面板显隐开关（联动 Splitter）+ 更多配置
	const settingsItems: MenuProps["items"] = [
		{
			key: "chat",
			label: (
				<div
					className="flex w-full items-center justify-between gap-3"
					onClick={(e) => e.stopPropagation()}
				>
					<span>对话面板</span>
					<Switch size="small" checked={showChat} onChange={onToggleChat} />
				</div>
			),
		},
		{
			key: "preview",
			label: (
				<div
					className="flex w-full items-center justify-between gap-3"
					onClick={(e) => e.stopPropagation()}
				>
					<span>预览面板</span>
					<Switch
						size="small"
						checked={showPreview}
						onChange={onTogglePreview}
					/>
				</div>
			),
		},
		{ type: "divider" },
		{ key: "more", label: "更多配置…" },
	];

	const onSettingsMenuClick: MenuProps["onClick"] = ({ key }) => {
		if (key === "more") onOpenSettings();
	};

	return (
		<div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-2">
			<Text className="truncate text-sm font-medium">HTML 页面编辑器</Text>

			<div className="flex min-w-0 shrink-0 items-center gap-1">
				<Button
					size="small"
					type="text"
					icon={<CopyOutlined />}
					onClick={() => void handleCopy()}
				>
					复制
				</Button>

				<Divider type="vertical" />

				<Dropdown
					menu={{ items: settingsItems, onClick: onSettingsMenuClick }}
					placement="bottomRight"
				>
					<Button type="text" size="small" icon={<SettingOutlined />}>
						设置
					</Button>
				</Dropdown>
			</div>
		</div>
	);
}
