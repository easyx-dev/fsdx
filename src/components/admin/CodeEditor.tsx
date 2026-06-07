/**
 * 基于 monaco-editor 的自定义代码编辑器组件
 * 支持语法高亮、JSON 校验、亮/暗主题、只读模式
 * value / onChange 兼容 antd Form.Item 注入
 */

import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import CssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import HtmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import TsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import { useEffect, useRef } from "react";

// 引入 Monaco ESM 构建所需的核心样式文件
import "monaco-editor/esm/vs/base/browser/ui/codicons/codicon/codicon.css";
import "monaco-editor/esm/vs/base/browser/ui/codicons/codicon/codicon-modifiers.css";
import "monaco-editor/esm/vs/editor/browser/widget/codeEditor/editor.css";
import "monaco-editor/esm/vs/editor/standalone/browser/standalone-tokens.css";

// 在 monaco 动态导入前配置 worker 环境，支持多种语言
self.MonacoEnvironment = {
	getWorker(_workerId: string, label: string) {
		if (label === "json") return new JsonWorker();
		if (label === "css" || label === "scss" || label === "less")
			return new CssWorker();
		if (label === "html" || label === "handlebars" || label === "razor")
			return new HtmlWorker();
		if (label === "typescript" || label === "javascript") return new TsWorker();
		return new EditorWorker();
	},
};

export interface CodeEditorProps {
	/** 编辑器内容 */
	value: string;
	/** 内容变化回调 */
	onChange?: (value: string) => void;
	/** 编程语言标识 */
	language: string;
	/** 是否只读 */
	readOnly?: boolean;
}

export function CodeEditor({
	value,
	onChange,
	language,
	readOnly = false,
}: CodeEditorProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<unknown>(null);
	// 使用 ref 追踪 onChange 避免重新初始化编辑器
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	// 初始化编辑器（language / readOnly 变化时重建，value 通过独立 effect 同步）
	// biome-ignore lint/correctness/useExhaustiveDependencies: value 通过独立 useEffect 同步
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		let disposed = false;

		async function initEditor() {
			// 使用主入口而非 editor.api，确保主题 CSS 变量正确注入
			const monaco = await import("monaco-editor");
			if (disposed || !container) return;

			const isDark =
				typeof document !== "undefined" &&
				document.documentElement.classList.contains("dark");

			const editor = monaco.editor.create(container, {
				value,
				language,
				theme: isDark ? "vs-dark" : "vs",
				readOnly,
				minimap: { enabled: false },
				scrollBeyondLastLine: false,
				wordWrap: "on",
				lineNumbers: "on",
				renderLineHighlight: "none",
				fontSize: 13,
				tabSize: 2,
				padding: { top: 12 },
				automaticLayout: true,
				scrollbar: {
					verticalScrollbarSize: 8,
					horizontalScrollbarSize: 8,
				},
			});

			editorRef.current = editor;

			editor.onDidChangeModelContent(() => {
				onChangeRef.current?.(editor.getValue());
			});
		}

		initEditor();

		return () => {
			disposed = true;
			if (editorRef.current) {
				(editorRef.current as { dispose: () => void }).dispose();
				editorRef.current = null;
			}
		};
	}, [language, readOnly]);

	// 外部 value 变化时同步到编辑器
	useEffect(() => {
		const editor = editorRef.current as
			| { getValue(): string; setValue(v: string): void }
			| undefined;
		if (editor && editor.getValue() !== value) {
			editor.setValue(value);
		}
	}, [value]);

	return (
		<div
			ref={containerRef}
			className="h-[300px] rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden"
		/>
	);
}
