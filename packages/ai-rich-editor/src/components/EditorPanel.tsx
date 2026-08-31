/**
 * 中栏代码编辑面板：Monaco（包内自带薄封装，懒加载）
 * 主题亮暗跟随宿主 data-theme 后缀，随主题切换实时联动
 */
import { lazy, Suspense } from "react";
import { useIsDark } from "../hooks/useIsDark";

// 懒加载 + 本地打包配置：monaco-setup 先执行 loader.config（本地 monaco-editor），
// 再加载编辑器组件；仅在客户端运行，SSR 下渲染 Suspense fallback
const MonacoEditor = lazy(() =>
	Promise.all([import("./monaco-setup"), import("@monaco-editor/react")]).then(
		([, mod]) => ({ default: mod.default }),
	),
);

interface EditorPanelProps {
	value: string;
	onChange?: (value: string) => void;
}

export function EditorPanel({ value, onChange }: EditorPanelProps) {
	const isDark = useIsDark();

	return (
		<div className="flex h-full flex-col bg-background">
			<Suspense
				fallback={
					<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
						代码编辑器加载中...
					</div>
				}
			>
				<MonacoEditor
					height="100%"
					language="html"
					theme={isDark ? "vs-dark" : "light"}
					value={value}
					onChange={(val) => onChange?.(val ?? "")}
					loading={
						<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
							代码编辑器加载中...
						</div>
					}
					options={{
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
			</Suspense>
		</div>
	);
}
