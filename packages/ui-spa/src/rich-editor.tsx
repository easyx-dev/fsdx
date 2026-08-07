/**
 * 基于 wangEditor v5 的富文本编辑器（纯展示组件）
 * 与业务解耦：图片上传通过 uploadImage 回调注入，由宿主决定上传实现
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

export interface RichEditorProps {
	/** 当前 HTML 内容（兼容 antd Form.Item 注入） */
	value?: string;
	/** 内容变化回调（兼容 antd Form.Item 注入） */
	onChange?: (html: string) => void;
	/**
	 * 图片上传回调：接收文件，返回可插入编辑器的图片地址
	 * 不传入则工具栏不启用自定义上传（图片无法上传）
	 */
	uploadImage?: (file: File) => Promise<string>;
}

export function RichEditor({
	value = "",
	onChange,
	uploadImage,
}: RichEditorProps) {
	const [editor, setEditor] = useState<IDomEditor | null>(null);

	/** 工具栏配置 */
	const toolbarConfig: Partial<IToolbarConfig> = useMemo(
		() => ({
			excludeKeys: ["group-video", "fullScreen"],
		}),
		[],
	);

	/** 编辑器配置：占位文字 + 可选的图片上传 */
	const editorConfig: Partial<IEditorConfig> = useMemo(() => {
		const config: Partial<IEditorConfig> = {
			placeholder: "开始写作...",
		};
		if (uploadImage) {
			config.MENU_CONF = {
				uploadImage: {
					async customUpload(file: File, insertFn: (url: string) => void) {
						try {
							const url = await uploadImage(file);
							if (url) {
								insertFn(url);
							}
						} catch (err) {
							// 上传失败不插入图片，错误提示交由宿主的上传实现负责
							console.error("富文本图片上传失败", err);
						}
					},
				},
			};
		}
		return config;
	}, [uploadImage]);

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
			className="flex flex-col rounded-md border border-border"
			style={{ zIndex: 100 }}
		>
			<Toolbar
				editor={editor}
				defaultConfig={toolbarConfig}
				mode="default"
				className="border-b border-border [&_.w-e-toolbar]:!rounded-md"
			/>
			<Editor
				defaultConfig={editorConfig}
				value={value}
				onCreated={setEditor}
				onChange={(ed: IDomEditor) => onChange?.(ed.getHtml())}
				mode="default"
				className="[&_.w-e-text-container]:min-h-[300px] [&_.w-e-text-container]:rounded-b-md"
			/>
		</div>
	);
}
