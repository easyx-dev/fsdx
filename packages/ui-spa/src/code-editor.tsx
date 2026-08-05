/**
 * 基于 @monaco-editor/react 的代码编辑器组件
 * 支持语法高亮、JSON 校验、亮/暗主题、只读模式
 * value / onChange 兼容 antd Form.Item 注入
 */
import Editor from "@monaco-editor/react";

export interface CodeEditorProps {
	/** 自定义类名 */
	className?: string;
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
	className,
	value,
	onChange,
	language,
	readOnly = false,
}: CodeEditorProps) {
	const isDark =
		typeof document !== "undefined" &&
		document.documentElement.classList.contains("dark");

	return (
		<div
			className={`h-[300px] rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden ${className}`}
		>
			<Editor
				height="100%"
				language={language}
				value={value}
				theme={isDark ? "vs-dark" : "light"}
				onChange={(val) => onChange?.(val ?? "")}
				loading={
					<div className="flex items-center justify-center h-full text-zinc-400 text-sm">
						编辑器加载中...
					</div>
				}
				options={{
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
				}}
			/>
		</div>
	);
}
