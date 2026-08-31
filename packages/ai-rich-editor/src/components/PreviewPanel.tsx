/**
 * 右栏预览面板：设备档位 + iframe sandbox 渲染 srcDoc
 * 桌面自适应拉伸（无壳）；手机为固定尺寸设备框；支持刷新与新窗口预览
 */
import { ExportOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Empty, Segmented, Switch, Tooltip } from "antd";
import { useState } from "react";
import { EMPTY_PREVIEW_TEXT, PREVIEW_DEVICES } from "../constants";
import { useElementSize } from "../hooks/useElementSize";
import { buildPreviewDocument } from "../utils/extract";

interface PreviewPanelProps {
	html: string;
	deviceKey: string;
	onDeviceKeyChange: (key: string) => void;
	scriptsEnabled: boolean;
	onToggleScripts: () => void;
	/** 注入预览 <head> 的附加代码（原始 HTML 片段） */
	previewHead?: string;
}

export function PreviewPanel({
	html,
	deviceKey,
	onDeviceKeyChange,
	scriptsEnabled,
	onToggleScripts,
	previewHead,
}: PreviewPanelProps) {
	const [reloadKey, setReloadKey] = useState(0);
	const [stageRef, stageSize] = useElementSize<HTMLDivElement>();

	const device =
		PREVIEW_DEVICES.find((d) => d.key === deviceKey) ?? PREVIEW_DEVICES[0];
	// 固定设备（手机）取 PREVIEW_DEVICES 的宽高；桌面自适应
	const fixedBox =
		device.key === "mobile" && typeof device.width === "number"
			? { w: device.width, h: device.height ?? 812 }
			: undefined;

	// 手机框按舞台空间等比缩放（≤100%）；桌面拉伸不缩放
	let fitZoom = 1;
	if (fixedBox && stageSize.width > 0 && stageSize.height > 0) {
		fitZoom = Math.min(
			1,
			stageSize.width / fixedBox.w,
			stageSize.height / fixedBox.h,
		);
	}

	// sandbox 默认隔离；允许脚本时放开 allow-scripts（仍需 allow-same-origin 加载 /file 资源）
	const sandbox = scriptsEnabled
		? "allow-scripts allow-same-origin"
		: "allow-same-origin";

	// 新窗口预览：以同源 about:blank 写入完整文档。
	// 说明：内容为受信编辑器产物，与预览 iframe（allow-scripts + allow-same-origin）同权；
	// 采用 document.write 是为保住 /file 相对资源（Blob URL 会脱离同源导致资源失效）。
	const openInNewWindow = () => {
		const win = window.open("", "_blank");
		if (!win) return;
		win.document.open();
		win.document.write(buildPreviewDocument(html, previewHead));
		win.document.close();
	};

	const renderScreen = (
		<iframe
			key={reloadKey}
			title="HTML 预览"
			srcDoc={buildPreviewDocument(html, previewHead)}
			sandbox={sandbox}
			className="h-full w-full border-0"
		/>
	);

	return (
		<div className="flex h-full w-full flex-col bg-background-secondary">
			{/* 预览头部：设备档位 + 脚本开关 + 刷新 + 新窗口 */}
			<div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border px-2">
				<Segmented<string>
					size="small"
					value={device.key}
					onChange={(val) => onDeviceKeyChange(val)}
					options={PREVIEW_DEVICES.map((d) => ({
						label: d.label,
						value: d.key,
					}))}
				/>
				<div className="flex items-center gap-1">
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
							onClick={() => setReloadKey((k) => k + 1)}
						/>
					</Tooltip>
					<Tooltip title="新窗口预览">
						<Button
							type="text"
							size="small"
							icon={<ExportOutlined />}
							aria-label="新窗口预览"
							onClick={openInNewWindow}
						/>
					</Tooltip>
				</div>
			</div>

			{/* 设备宽度舞台：桌面拉伸、手机固定缩放居中 */}
			<div
				ref={stageRef}
				className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3"
			>
				{html.trim() ? (
					fixedBox ? (
						<div
							className="flex flex-col overflow-hidden border border-divider bg-white shadow-md"
							style={{
								width: fixedBox.w,
								height: fixedBox.h,
								transform: `scale(${fitZoom})`,
								transformOrigin: "center",
							}}
						>
							{renderScreen}
						</div>
					) : (
						<div className="flex h-full w-full flex-col overflow-hidden bg-white">
							{renderScreen}
						</div>
					)
				) : (
					<div className="flex h-full w-full items-center justify-center bg-white p-6">
						<Empty
							image={Empty.PRESENTED_IMAGE_SIMPLE}
							description={EMPTY_PREVIEW_TEXT}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
