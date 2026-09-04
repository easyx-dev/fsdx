/**
 * 编辑器主顶栏：预览控件（设备/脚本/刷新/新窗口）+ 编辑器开关 + 复制 + 设置
 * 预览面板自身不含头部控制条，控件统一收拢到主顶栏
 */
import {
	CodeOutlined,
	CopyOutlined,
	ExportOutlined,
	ReloadOutlined,
	SettingOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import {
	Button,
	Divider,
	Dropdown,
	Segmented,
	Switch,
	Tooltip,
	Typography,
} from "antd";
import { PREVIEW_DEVICES } from "../constants";
import type { AiRichNotify } from "../types";

const { Text } = Typography;

interface ToolbarProps {
	html: string;
	// 预览控件
	deviceKey: string;
	onDeviceKeyChange: (key: string) => void;
	scriptsEnabled: boolean;
	onToggleScripts: () => void;
	onRefresh: () => void;
	onOpenInNewWindow: () => void;
	// 编辑器开关
	showEditor: boolean;
	onToggleEditor: () => void;
	/** 打开设置面板 */
	onOpenSettings: () => void;
	notify?: AiRichNotify;
}

export function Toolbar({
	html,
	deviceKey,
	onDeviceKeyChange,
	scriptsEnabled,
	onToggleScripts,
	onRefresh,
	onOpenInNewWindow,
	showEditor,
	onToggleEditor,
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

	// 「设置」下拉：更多配置
	const settingsItems: MenuProps["items"] = [
		{ key: "more", label: "更多配置…" },
	];

	const onSettingsMenuClick: MenuProps["onClick"] = ({ key }) => {
		if (key === "more") onOpenSettings();
	};

	return (
		<div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-2">
			<Text className="truncate text-sm font-medium">HTML 页面编辑器</Text>

			<div className="flex min-w-0 shrink-0 items-center gap-1">
				{/* 预览控件组 */}
				<Segmented<string>
					size="small"
					value={deviceKey}
					onChange={(val) => onDeviceKeyChange(val)}
					options={PREVIEW_DEVICES.map((d) => ({
						label: d.label,
						value: d.key,
					}))}
				/>
				<Tooltip title="允许预览中的脚本执行">
					<Switch
						size="small"
						checked={scriptsEnabled}
						onChange={onToggleScripts}
						checkedChildren="JS"
						unCheckedChildren="JS"
					/>
				</Tooltip>
				<Tooltip title="刷新预览（重新执行脚本）">
					<Button
						type="text"
						size="small"
						icon={<ReloadOutlined />}
						aria-label="刷新预览"
						onClick={onRefresh}
					/>
				</Tooltip>
				<Tooltip title="新窗口预览">
					<Button
						type="text"
						size="small"
						icon={<ExportOutlined />}
						aria-label="新窗口预览"
						onClick={onOpenInNewWindow}
					/>
				</Tooltip>

				<Divider type="vertical" />

				{/* 编辑器开关 */}
				<span className="mr-1 flex items-center gap-1.5 text-xs text-foreground-secondary">
					<CodeOutlined /> 编辑器
				</span>
				<Switch size="small" checked={showEditor} onChange={onToggleEditor} />

				<Divider type="vertical" />

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
