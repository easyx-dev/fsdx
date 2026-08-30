/**
 * 三栏编辑器顶栏：折叠开关 / 输出形态 / 设备宽度 / 脚本开关 / 复制
 * 高度固定，营造"工作台"式统一操作区
 */
import {
	CopyOutlined,
	MenuFoldOutlined,
	MenuUnfoldOutlined,
} from "@ant-design/icons";
import { Button, Segmented, Select, Switch, Tooltip, Typography } from "antd";
import { PREVIEW_DEVICES } from "../constants";
import type { AiChatMode, AiRichNotify } from "../types";

const { Text } = Typography;

interface ToolbarProps {
	html: string;
	showChat: boolean;
	onToggleChat: () => void;
	showPreview: boolean;
	onTogglePreview: () => void;
	deviceKey: string;
	onDeviceKeyChange: (key: string) => void;
	scriptsEnabled: boolean;
	onToggleScripts: () => void;
	mode: AiChatMode;
	onModeChange: (mode: AiChatMode) => void;
	notify?: AiRichNotify;
}

export function Toolbar({
	html,
	showChat,
	onToggleChat,
	showPreview,
	onTogglePreview,
	deviceKey,
	onDeviceKeyChange,
	scriptsEnabled,
	onToggleScripts,
	mode,
	onModeChange,
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

	return (
		<div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-2">
			<div className="flex min-w-0 shrink-0 items-center gap-1">
				<Tooltip title={showChat ? "隐藏 AI 对话" : "显示 AI 对话"}>
					<Button
						type="text"
						size="small"
						icon={<MenuFoldOutlined />}
						aria-label="切换 AI 对话面板"
						onClick={onToggleChat}
					/>
				</Tooltip>
				<Text className="truncate text-sm font-medium">HTML 页面编辑器</Text>
			</div>

			<div className="flex min-w-0 flex-1 items-center justify-center gap-2">
				<Segmented<AiChatMode>
					size="small"
					value={mode}
					onChange={(val) => onModeChange(val)}
					options={[
						{ label: "片段", value: "fragment" },
						{ label: "完整文档", value: "document" },
					]}
				/>
				<Select
					size="small"
					value={deviceKey}
					onChange={onDeviceKeyChange}
					options={PREVIEW_DEVICES.map((d) => ({
						value: d.key,
						label: d.label,
					}))}
					style={{ width: 84 }}
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
				<Button
					size="small"
					type="text"
					icon={<CopyOutlined />}
					onClick={() => void handleCopy()}
				>
					复制
				</Button>
			</div>

			<Tooltip title={showPreview ? "隐藏预览" : "显示预览"}>
				<Button
					type="text"
					size="small"
					icon={<MenuUnfoldOutlined />}
					aria-label="切换预览面板"
					onClick={onTogglePreview}
				/>
			</Tooltip>
		</div>
	);
}
