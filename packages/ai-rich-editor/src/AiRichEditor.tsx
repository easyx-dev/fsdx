/**
 * AI Rich Editor 主容器：顶栏 + 左(AI 对话) / 中(Monaco) / 右(iframe 预览) 三栏
 * value / onChange 兼容受控注入；对话能力由调用方通过 adapter 注入
 */
import { useCallback, useMemo, useState } from "react";
import { ChatPanel } from "./components/ChatPanel";
import { EditorPanel } from "./components/EditorPanel";
import { PreviewPanel } from "./components/PreviewPanel";
import { Toolbar } from "./components/Toolbar";
import { DEFAULT_HTML, PREVIEW_DEVICES } from "./constants";
import { useAiChat } from "./hooks/useAiChat";
import type { AiChatMode, AiRichEditorProps } from "./types";
import { extractHtmlFragments } from "./utils/extract";

const CHAT_PANEL_WIDTH = 300;
const PREVIEW_PANEL_WIDTH = 400;

export function AiRichEditor({
	value = DEFAULT_HTML,
	onChange,
	height = 640,
	mode: initialMode = "fragment",
	adapter,
	notify,
	autoApply = true,
	systemPrompt,
}: AiRichEditorProps) {
	const [showChat, setShowChat] = useState(true);
	const [showPreview, setShowPreview] = useState(true);
	const [deviceKey, setDeviceKey] = useState("desktop");
	const [scriptsEnabled, setScriptsEnabled] = useState(true);
	const [mode, setMode] = useState<AiChatMode>(initialMode);

	// 流结束回调：AI 生成的 HTML 代码块自动应用到编辑器（保留手动按钮）
	const handleAiComplete = useCallback(
		(content: string) => {
			if (!autoApply) return;
			const html = extractHtmlFragments(content)[0];
			if (html) onChange?.(html);
		},
		[autoApply, onChange],
	);

	const chat = useAiChat({
		currentHtml: value,
		adapter,
		mode,
		systemPrompt,
		onComplete: handleAiComplete,
	});

	// 「应用到编辑器」：AI 生成的代码块替换当前内容
	const handleApplyHtml = useCallback(
		(html: string) => onChange?.(html),
		[onChange],
	);

	const currentDevice = useMemo(
		() =>
			PREVIEW_DEVICES.find((d) => d.key === deviceKey) ?? PREVIEW_DEVICES[0],
		[deviceKey],
	);

	return (
		<div
			className="flex flex-col overflow-hidden rounded-md border border-divider bg-background"
			style={{
				height: typeof height === "number" ? `${height}px` : height,
			}}
		>
			<Toolbar
				html={value}
				showChat={showChat}
				onToggleChat={() => setShowChat((prev) => !prev)}
				showPreview={showPreview}
				onTogglePreview={() => setShowPreview((prev) => !prev)}
				deviceKey={deviceKey}
				onDeviceKeyChange={setDeviceKey}
				scriptsEnabled={scriptsEnabled}
				onToggleScripts={() => setScriptsEnabled((prev) => !prev)}
				mode={mode}
				onModeChange={setMode}
				notify={notify}
			/>

			<div className="flex min-h-0 flex-1">
				{showChat && (
					<div
						className="shrink-0 border-r border-divider"
						style={{ width: CHAT_PANEL_WIDTH }}
					>
						<ChatPanel controller={chat} onApplyHtml={handleApplyHtml} />
					</div>
				)}

				<div className="min-w-0 flex-1">
					<EditorPanel value={value} onChange={onChange} />
				</div>

				{showPreview && (
					<div
						className="shrink-0 border-l border-divider"
						style={{ width: PREVIEW_PANEL_WIDTH }}
					>
						<PreviewPanel
							html={value}
							mode={mode}
							device={currentDevice}
							scriptsEnabled={scriptsEnabled}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
