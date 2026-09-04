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
import {
	buildPreviewDocument,
	currentHtmlFragment,
	lastHtmlFragment,
} from "./utils/extract";
import { generateScopePrefix, scopedRichContent } from "./utils/scope";

/** 流式实时同步阈值：HTML 代码块累计新增达到该字符数时同步到编辑器+预览 */
const LIVE_SYNC_CHAR_THRESHOLD = 200;

export function AiRichEditor({
	value = DEFAULT_HTML,
	onChange,
	endpointUrl,
	requestMeta,
	height = 640,
	config,
	onConfigChange,
}: AiRichEditorProps) {
	// 作用域前缀：实例（会话）创建时生成一次并一直沿用，避免每次应用换随机前缀导致前缀漂移/重复包裹
	const [scopePrefix] = useState(() => generateScopePrefix());
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
	// 已应用过的 HTML 片段（用于流式实时同步判断「累计新增」的基准）
	const lastAppliedRef = useRef("");
	// 当前流式处理中的 assistant 消息 id（新一轮消息出现时重置同步基准）
	const lastStreamMsgIdRef = useRef<string | null>(null);

	// 流结束回调：AI 生成的 HTML 代码块自动应用到编辑器（保留手动按钮）；
	// 应用前先做样式作用域化（沿用实例级 scopePrefix），使产物自带 scope 前缀，宿主可直接当作 HTML 引入（不污染全局）
	const handleAiComplete = useCallback(
		(content: string) => {
			if (!autoApply) return;
			// 修改类回复可能先贴旧/分块内容再给最终产物，取最后一个代码块更贴近「改动后的完整片段」
			const html = lastHtmlFragment(content);
			if (html) {
				lastAppliedRef.current = html;
				onChange?.(scopedRichContent(html, scopePrefix));
			} else {
				notify?.("warning", "本次回复未检测到 HTML 代码块，已跳过自动应用");
			}
		},
		[autoApply, onChange, scopePrefix, notify],
	);

	// 「应用到编辑器」：AI 生成的代码块替换当前内容（同样先作用域化）
	const handleApplyHtml = useCallback(
		(html: string) => onChange?.(scopedRichContent(html, scopePrefix)),
		[onChange, scopePrefix],
	);

	// 顶栏「新窗口预览」：以同源 about:blank 写入完整文档。
	// 说明：内容为受信编辑器产物，与预览 iframe（allow-scripts + allow-same-origin）同权；
	// 采用 document.write 是为保住 /file 相对资源（Blob URL 会脱离同源导致资源失效）。
	const handleOpenInNewWindow = useCallback(() => {
		const win = window.open("", "_blank");
		if (!win) return;
		win.document.open();
		// value 在应用时刻已作用域化，此处直接构造文档外壳
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

	// 流式实时同步：AI 生成中，最后一条 assistant 消息的 HTML 代码块累计新增达到阈值，
	// 即把当前已生成片段同步到编辑器与预览（作用域化沿用实例级 scopePrefix）
	useEffect(() => {
		if (!autoApply) return;
		const lastMsg = chat.messages.at(-1);
		if (lastMsg?.role !== "assistant") return;
		// 新一轮 assistant 消息（如二次修改重写）出现时重置基准，避免因新片段更短导致长度差为负而漏同步
		if (lastStreamMsgIdRef.current !== lastMsg.id) {
			lastStreamMsgIdRef.current = lastMsg.id;
			lastAppliedRef.current = "";
		}
		let full = "";
		for (const part of lastMsg.parts) {
			if (part.type === "text" && typeof part.content === "string") {
				full += part.content;
			}
		}
		const frag = currentHtmlFragment(full);
		if (!frag) return;
		if (
			frag.length - lastAppliedRef.current.length <
			LIVE_SYNC_CHAR_THRESHOLD
		) {
			return;
		}
		lastAppliedRef.current = frag;
		onChange?.(scopedRichContent(frag, scopePrefix));
	}, [chat.messages, autoApply, onChange, scopePrefix]);

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
