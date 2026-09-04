/**
 * AI Rich Editor 主容器：顶栏 + 左(预览，可选编辑器)/右(AI 对话) 两栏工作台
 * 默认两栏：左=预览区、右=AI 对话面板（min400/max600）；「编辑器」为顶栏开关，打开后在左栏与预览并排。
 * value / onChange 兼容受控注入；对话能力由调用方通过 adapter 注入；
 * 包配置项统一收拢到 config，经设置面板编辑保存生效
 */
import { Splitter } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	createInstanceChatOverrides,
	EditorCfgContext,
	useAppChat,
} from "./chat/ChatProvider";
import { EditorPanel } from "./components/EditorPanel";
import { PreviewPanel } from "./components/PreviewPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { Toolbar } from "./components/Toolbar";
import { DEFAULT_CONFIG, DEFAULT_HTML } from "./constants";
import type { AiRichEditorConfig, AiRichEditorProps } from "./types";
import { buildPreviewDocument, extractHtmlFragments } from "./utils/extract";

export function AiRichEditor({
	value = DEFAULT_HTML,
	onChange,
	endpointUrl,
	requestMeta,
	height = 640,
	config,
	onConfigChange,
}: AiRichEditorProps) {
	const [showEditor, setShowEditor] = useState(false);
	const [deviceKey, setDeviceKey] = useState("desktop");
	const [scriptsEnabled, setScriptsEnabled] = useState(true);
	const [reloadKey, setReloadKey] = useState(0);
	const [settingsOpen, setSettingsOpen] = useState(false);
	// 运行期配置：config 作为初始值，设置面板保存后更新（不受 config 后续变化影响）
	const [runtimeConfig, setRuntimeConfig] = useState<AiRichEditorConfig>(
		() => ({
			...DEFAULT_CONFIG,
			...config,
		}),
	);
	const { autoApply, systemPrompt, previewHead, notify } = runtimeConfig;

	// 流结束回调：AI 生成的 HTML 代码块自动应用到编辑器（保留手动按钮）
	const handleAiComplete = useCallback(
		(content: string) => {
			if (!autoApply) return;
			const html = extractHtmlFragments(content)[0];
			if (html) onChange?.(html);
		},
		[autoApply, onChange],
	);

	// 「应用到编辑器」：AI 生成的代码块替换当前内容
	const handleApplyHtml = useCallback(
		(html: string) => onChange?.(html),
		[onChange],
	);

	// 顶栏「新窗口预览」：以同源 about:blank 写入完整文档。
	// 说明：内容为受信编辑器产物，与预览 iframe（allow-scripts + allow-same-origin）同权；
	// 采用 document.write 是为保住 /file 相对资源（Blob URL 会脱离同源导致资源失效）。
	const handleOpenInNewWindow = useCallback(() => {
		const win = window.open("", "_blank");
		if (!win) return;
		win.document.open();
		win.document.write(buildPreviewDocument(value, previewHead));
		win.document.close();
	}, [value, previewHead]);

	// 每实例 chat 运行时值：endpointUrl / onComplete（autoApply）经 overrides 注入，多实例互不串线
	const endpointUrlRef = useRef(endpointUrl);
	useEffect(() => {
		endpointUrlRef.current = endpointUrl;
	}, [endpointUrl]);
	const onCompleteRef = useRef<((content: string) => void) | undefined>(
		handleAiComplete,
	);
	useEffect(() => {
		onCompleteRef.current = handleAiComplete;
	}, [handleAiComplete]);

	const chatOverrides = useMemo(
		() => createInstanceChatOverrides(endpointUrlRef, onCompleteRef),
		[],
	);
	// 对话实例（headless UI）；connection/onFinish 为库 overrides 类型未收编的字段，此处转义
	const chat = useAppChat(chatOverrides as never);

	const editorCfg = useMemo(
		() => ({
			systemPrompt,
			requestMeta,
			onApplyHtml: handleApplyHtml,
			notify,
		}),
		[systemPrompt, requestMeta, handleApplyHtml, notify],
	);

	// 设置面板保存：回写运行期配置并通知宿主
	const handleSaveSettings = useCallback(
		(cfg: AiRichEditorConfig) => {
			setRuntimeConfig(cfg);
			onConfigChange?.(cfg);
			setSettingsOpen(false);
		},
		[onConfigChange],
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
				deviceKey={deviceKey}
				onDeviceKeyChange={setDeviceKey}
				scriptsEnabled={scriptsEnabled}
				onToggleScripts={() => setScriptsEnabled((prev) => !prev)}
				onRefresh={() => setReloadKey((k) => k + 1)}
				onOpenInNewWindow={handleOpenInNewWindow}
				showEditor={showEditor}
				onToggleEditor={() => setShowEditor((prev) => !prev)}
				onOpenSettings={() => setSettingsOpen(true)}
				notify={notify}
			/>

			<Splitter className="min-h-0 flex-1" orientation="horizontal">
				{/* 左栏：预览区（编辑器开启时与编辑器并排） */}
				<Splitter.Panel>
					{showEditor ? (
						<Splitter className="h-full" orientation="horizontal">
							<Splitter.Panel min={300}>
								<EditorPanel value={value} onChange={onChange} />
							</Splitter.Panel>
							<Splitter.Panel min={320}>
								<PreviewPanel
									html={value}
									deviceKey={deviceKey}
									scriptsEnabled={scriptsEnabled}
									reloadKey={reloadKey}
									previewHead={previewHead}
								/>
							</Splitter.Panel>
						</Splitter>
					) : (
						<PreviewPanel
							html={value}
							deviceKey={deviceKey}
							scriptsEnabled={scriptsEnabled}
							reloadKey={reloadKey}
							previewHead={previewHead}
						/>
					)}
				</Splitter.Panel>

				{/* 右栏：AI 对话面板 */}
				<Splitter.Panel defaultSize={420} min={400} max={600}>
					<EditorCfgContext.Provider value={editorCfg}>
						<chat.AppChat />
					</EditorCfgContext.Provider>
				</Splitter.Panel>
			</Splitter>

			<SettingsPanel
				open={settingsOpen}
				config={runtimeConfig}
				onClose={() => setSettingsOpen(false)}
				onSave={handleSaveSettings}
			/>
		</div>
	);
}
