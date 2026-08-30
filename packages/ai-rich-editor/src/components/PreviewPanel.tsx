/**
 * 右栏预览面板：iframe sandbox 渲染 srcDoc
 * 脚本默认允许（受信编辑器环境），脚本开关见顶栏；样式与主文档完全隔离
 */
import { Empty } from "antd";
import { EMPTY_PREVIEW_TEXT, type PreviewDevice } from "../constants";
import type { AiChatMode } from "../types";
import { buildPreviewDocument } from "../utils/extract";

interface PreviewPanelProps {
	html: string;
	mode: AiChatMode;
	/** 当前档位 */
	device: PreviewDevice;
	/** 是否允许 iframe 内脚本 */
	scriptsEnabled: boolean;
}

export function PreviewPanel({
	html,
	mode,
	device,
	scriptsEnabled,
}: PreviewPanelProps) {
	// sandbox 默认隔离；允许脚本时放开 allow-scripts（仍需 allow-same-origin 加载 /file 资源）
	const sandbox = scriptsEnabled
		? "allow-scripts allow-same-origin"
		: "allow-same-origin";

	return (
		<div className="flex h-full w-full flex-col bg-background-secondary">
			{/* 设备宽度容器：超宽时水平居中 */}
			<div className="flex min-h-0 flex-1 justify-center overflow-auto p-3">
				<div
					className="h-full overflow-hidden rounded border border-divider shadow-sm"
					style={{
						width: typeof device.width === "number" ? device.width : undefined,
						flex: device.width === "100%" ? "1 1 auto" : undefined,
					}}
				>
					{html.trim() ? (
						<iframe
							title="HTML 预览"
							srcDoc={buildPreviewDocument(html, mode)}
							sandbox={sandbox}
							className="h-full w-full border-0 bg-white"
						/>
					) : (
						<div className="flex h-full items-center justify-center bg-white p-6">
							<Empty
								image={Empty.PRESENTED_IMAGE_SIMPLE}
								description={EMPTY_PREVIEW_TEXT}
							/>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
