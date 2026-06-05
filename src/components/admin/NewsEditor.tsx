/**
 * TipTap 富文本编辑器组件
 */

import ImageExtension from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
	Bold,
	Code,
	Heading1,
	Heading2,
	Heading3,
	Italic,
	List,
	ListOrdered,
	Quote,
	Redo,
	Strikethrough,
	Undo,
} from "lucide-react";

interface Props {
	content: string;
	onChange: (html: string) => void;
}

export function NewsEditor({ content, onChange }: Props) {
	const editor = useEditor({
		extensions: [
			StarterKit,
			Placeholder.configure({ placeholder: "开始写作..." }),
			ImageExtension,
		],
		content: content ? JSON.parse(content) : "",
		onUpdate: ({ editor }) => {
			onChange(JSON.stringify(editor.getJSON()));
		},
		editorProps: {
			attributes: {
				class:
					"prose prose-zinc max-w-none focus:outline-none min-h-[300px] px-4 py-3 text-sm",
			},
		},
	});

	if (!editor) return null;

	const ToolBtn = ({
		active,
		onClick,
		children,
		title,
	}: {
		active?: boolean;
		onClick: () => void;
		children: React.ReactNode;
		title: string;
	}) => (
		<button
			type="button"
			onClick={onClick}
			title={title}
			className={`rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 ${active ? "bg-zinc-100 text-zinc-900" : ""}`}
		>
			{children}
		</button>
	);

	return (
		<div className="flex flex-col">
			<div className="flex flex-wrap items-center gap-0.5 border-b border-zinc-200 px-3 py-1.5">
				<ToolBtn
					active={editor.isActive("bold")}
					onClick={() => editor.chain().focus().toggleBold().run()}
					title="加粗"
				>
					<Bold size={16} />
				</ToolBtn>
				<ToolBtn
					active={editor.isActive("italic")}
					onClick={() => editor.chain().focus().toggleItalic().run()}
					title="斜体"
				>
					<Italic size={16} />
				</ToolBtn>
				<ToolBtn
					active={editor.isActive("strike")}
					onClick={() => editor.chain().focus().toggleStrike().run()}
					title="删除线"
				>
					<Strikethrough size={16} />
				</ToolBtn>
				<span className="mx-1 w-px h-5 bg-zinc-200" />
				<ToolBtn
					active={editor.isActive("heading", { level: 1 })}
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 1 }).run()
					}
					title="标题 1"
				>
					<Heading1 size={16} />
				</ToolBtn>
				<ToolBtn
					active={editor.isActive("heading", { level: 2 })}
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 2 }).run()
					}
					title="标题 2"
				>
					<Heading2 size={16} />
				</ToolBtn>
				<ToolBtn
					active={editor.isActive("heading", { level: 3 })}
					onClick={() =>
						editor.chain().focus().toggleHeading({ level: 3 }).run()
					}
					title="标题 3"
				>
					<Heading3 size={16} />
				</ToolBtn>
				<span className="mx-1 w-px h-5 bg-zinc-200" />
				<ToolBtn
					active={editor.isActive("bulletList")}
					onClick={() => editor.chain().focus().toggleBulletList().run()}
					title="无序列表"
				>
					<List size={16} />
				</ToolBtn>
				<ToolBtn
					active={editor.isActive("orderedList")}
					onClick={() => editor.chain().focus().toggleOrderedList().run()}
					title="有序列表"
				>
					<ListOrdered size={16} />
				</ToolBtn>
				<ToolBtn
					active={editor.isActive("code")}
					onClick={() => editor.chain().focus().toggleCode().run()}
					title="行内代码"
				>
					<Code size={16} />
				</ToolBtn>
				<ToolBtn
					active={editor.isActive("blockquote")}
					onClick={() => editor.chain().focus().toggleBlockquote().run()}
					title="引用"
				>
					<Quote size={16} />
				</ToolBtn>
				<span className="mx-1 w-px h-5 bg-zinc-200" />
				<ToolBtn
					onClick={() => editor.chain().focus().undo().run()}
					title="撤销"
				>
					<Undo size={16} />
				</ToolBtn>
				<ToolBtn
					onClick={() => editor.chain().focus().redo().run()}
					title="重做"
				>
					<Redo size={16} />
				</ToolBtn>
			</div>
			<EditorContent editor={editor} />
		</div>
	);
}
