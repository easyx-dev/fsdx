/**
 * 基于 wangEditor v5 的富文本编辑器组件
 * 支持文本样式 / 标题 / 列表 / 对齐 / 表格 / 链接 / 图片上传 / 代码块
 * value / onChange 兼容 antd Form.Item 直接注入
 */
import "@wangeditor/editor/dist/css/style.css";

import type {
	IDomEditor,
	IEditorConfig,
	IToolbarConfig,
} from "@wangeditor/editor";
import { Editor, Toolbar } from "@wangeditor/editor-for-react";
import { useEffect, useMemo, useState } from "react";
import { uploadFile } from "#/server/file/file.functions";

interface Props {
	value?: string;
	onChange?: (html: string) => void;
}

export function RichEditor({ value = "", onChange }: Props) {
	const [editor, setEditor] = useState<IDomEditor | null>(null);

	/** 工具栏配置 */
	const toolbarConfig: Partial<IToolbarConfig> = useMemo(
		() => ({
			excludeKeys: ["group-video", "fullScreen"],
		}),
		[],
	);

	/** 编辑器配置：图片上传 + 占位文字 */
	const editorConfig: Partial<IEditorConfig> = useMemo(
		() => ({
			placeholder: "开始写作...",
			MENU_CONF: {
				uploadImage: {
					async customUpload(file: File, insertFn: (url: string) => void) {
						try {
							const fd = new FormData();
							fd.append("file", file);
							const result = await uploadFile({ data: fd });
							if (result?.data?.id) {
								insertFn(`/api/download/file/${result.data.id}`);
							}
						} catch {
							// 上传失败静默忽略
						}
					},
				},
			},
		}),
		[],
	);

	// 组件销毁时销毁编辑器
	useEffect(() => {
		return () => {
			if (editor) {
				editor.destroy();
				setEditor(null);
			}
		};
	}, [editor]);

	return (
		<div
			className="flex flex-col rounded-md border border-zinc-200 dark:border-zinc-700"
			style={{ zIndex: 100 }}
		>
			<Toolbar
				editor={editor}
				defaultConfig={toolbarConfig}
				mode="default"
				className="border-b border-zinc-200 dark:border-zinc-700 [&_.w-e-toolbar]:!rounded-md"
			/>
			<Editor
				defaultConfig={editorConfig}
				value={value}
				onCreated={setEditor}
				onChange={(ed) => onChange?.(ed.getHtml())}
				mode="default"
				className="[&_.w-e-text-container]:min-h-[300px] [&_.w-e-text-container]:rounded-b-md"
			/>
		</div>
	);
}
