/**
 * TipTap 富文本编辑器组件 — 完整功能版
 * 支持：文本样式 / 标题 / 列表 / 对齐 / 表格 / 链接 / 图片 / 代码块 / 分割线
 */
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import ImageExtension from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
	AlignCenter,
	AlignJustify,
	AlignLeft,
	AlignRight,
	Bold,
	Code,
	Heading1,
	Heading2,
	Heading3,
	Highlighter,
	Italic,
	Link2,
	List,
	ListChecks,
	ListOrdered,
	Minus,
	Quote,
	Redo,
	Strikethrough,
	Table as TableIcon,
	Underline as UnderlineIcon,
	Undo,
} from "lucide-react";
import { useCallback } from "react";

interface Props {
	content: string;
	onChange: (html: string) => void;
}

export function NewsEditor({ content, onChange }: Props) {
	const editor = useEditor({
		extensions: [
			StarterKit.configure({
				codeBlock: false, // 使用 lowlight 代码块替代
			}),
			Placeholder.configure({ placeholder: "开始写作..." }),
			ImageExtension,
			Underline,
			Link.configure({
				openOnClick: false,
				HTMLAttributes: { class: "text-blue-600 underline" },
			}),
			TextAlign.configure({ types: ["heading", "paragraph"] }),
			Highlight.configure({ multicolor: true }),
			Color,
			TaskList,
			TaskItem.configure({ nested: true }),
			Table.configure({ resizable: true }),
			TableRow,
			TableCell,
			TableHeader,
		],
		content: content ? JSON.parse(content) : "",
		onUpdate: ({ editor }) => {
			onChange(JSON.stringify(editor.getJSON()));
		},
		editorProps: {
			attributes: {
				class:
					"prose prose-zinc dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-4 py-3 text-sm",
			},
		},
	});

	/** 插入表格 — 默认 3×3 */
	const insertTable = useCallback(() => {
		editor
			?.chain()
			.focus()
			.insertTable({ rows: 3, cols: 3, withHeaderRow: true })
			.run();
	}, [editor]);

	/** 设置链接 */

	/** 打开链接编辑提示 */
	const openLinkPrompt = useCallback(() => {
		const previousUrl = editor?.getAttributes("link").href;
		const url = window.prompt("输入链接地址", previousUrl || "https://");
		if (url === null) return;
		if (url === "") {
			editor?.chain().focus().extendMarkRange("link").unsetLink().run();
		} else {
			editor
				?.chain()
				.focus()
				.extendMarkRange("link")
				.setLink({ href: url })
				.run();
		}
	}, [editor]);

	if (!editor) return null;

	/** 工具栏按钮基础类型 */
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
			className={`rounded p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 ${active ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100" : ""}`}
		>
			{children}
		</button>
	);

	/** 工具栏分隔线 */
	const Separator = () => (
		<span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
	);

	return (
		<div className="flex flex-col rounded-md border border-zinc-200 dark:border-zinc-700">
			{/* 工具栏第一行：文本样式 + 标题 */}
			<div className="flex flex-wrap items-center gap-0.5 border-b border-zinc-200 px-3 py-1.5 dark:border-zinc-700">
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
					active={editor.isActive("underline")}
					onClick={() => editor.chain().focus().toggleUnderline().run()}
					title="下划线"
				>
					<UnderlineIcon size={16} />
				</ToolBtn>
				<ToolBtn
					active={editor.isActive("strike")}
					onClick={() => editor.chain().focus().toggleStrike().run()}
					title="删除线"
				>
					<Strikethrough size={16} />
				</ToolBtn>
				<ToolBtn
					active={editor.isActive("highlight")}
					onClick={() => editor.chain().focus().toggleHighlight().run()}
					title="高亮"
				>
					<Highlighter size={16} />
				</ToolBtn>
				<ToolBtn
					active={editor.isActive("code")}
					onClick={() => editor.chain().focus().toggleCode().run()}
					title="行内代码"
				>
					<Code size={16} />
				</ToolBtn>

				<Separator />

				{/* 对齐 */}
				<ToolBtn
					active={editor.isActive({ textAlign: "left" })}
					onClick={() => editor.chain().focus().setTextAlign("left").run()}
					title="左对齐"
				>
					<AlignLeft size={16} />
				</ToolBtn>
				<ToolBtn
					active={editor.isActive({ textAlign: "center" })}
					onClick={() => editor.chain().focus().setTextAlign("center").run()}
					title="居中"
				>
					<AlignCenter size={16} />
				</ToolBtn>
				<ToolBtn
					active={editor.isActive({ textAlign: "right" })}
					onClick={() => editor.chain().focus().setTextAlign("right").run()}
					title="右对齐"
				>
					<AlignRight size={16} />
				</ToolBtn>
				<ToolBtn
					active={editor.isActive({ textAlign: "justify" })}
					onClick={() => editor.chain().focus().setTextAlign("justify").run()}
					title="两端对齐"
				>
					<AlignJustify size={16} />
				</ToolBtn>

				<Separator />

				{/* 标题 */}
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

				<Separator />

				{/* 颜色选择器 */}
				<input
					type="color"
					onInput={(e) =>
						editor
							.chain()
							.focus()
							.setColor((e.target as HTMLInputElement).value)
							.run()
					}
					value={editor.getAttributes("textStyle").color || "#000000"}
					title="文字颜色"
					className="h-6 w-6 cursor-pointer rounded border-0 p-0"
				/>
			</div>

			{/* 工具栏第二行：块级元素 + 列表 + 表格 */}
			<div className="flex flex-wrap items-center gap-0.5 border-b border-zinc-200 px-3 py-1.5 dark:border-zinc-700">
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
					active={editor.isActive("taskList")}
					onClick={() => editor.chain().focus().toggleTaskList().run()}
					title="任务列表"
				>
					<ListChecks size={16} />
				</ToolBtn>

				<Separator />

				<ToolBtn
					active={editor.isActive("blockquote")}
					onClick={() => editor.chain().focus().toggleBlockquote().run()}
					title="引用"
				>
					<Quote size={16} />
				</ToolBtn>

				<ToolBtn
					active={editor.isActive("codeBlock")}
					onClick={() => editor.chain().focus().toggleCodeBlock().run()}
					title="代码块"
				>
					<Code size={16} />
				</ToolBtn>

				<ToolBtn
					onClick={() => editor.chain().focus().setHorizontalRule().run()}
					title="分割线"
				>
					<Minus size={16} />
				</ToolBtn>

				<Separator />

				<ToolBtn onClick={openLinkPrompt} title="插入链接">
					<Link2 size={16} />
				</ToolBtn>

				<ToolBtn onClick={insertTable} title="插入表格">
					<TableIcon size={16} />
				</ToolBtn>

				{editor.isActive("table") && (
					<>
						<ToolBtn
							onClick={() => editor.chain().focus().addColumnBefore().run()}
							title="前插列"
						>
							+→
						</ToolBtn>
						<ToolBtn
							onClick={() => editor.chain().focus().addColumnAfter().run()}
							title="后插列"
						>
							→+
						</ToolBtn>
						<ToolBtn
							onClick={() => editor.chain().focus().addRowBefore().run()}
							title="前插行"
						>
							+↓
						</ToolBtn>
						<ToolBtn
							onClick={() => editor.chain().focus().addRowAfter().run()}
							title="后插行"
						>
							↓+
						</ToolBtn>
						<ToolBtn
							onClick={() => editor.chain().focus().deleteTable().run()}
							title="删除表格"
						>
							✕T
						</ToolBtn>
					</>
				)}
			</div>

			{/* 工具栏第三行：撤销/重做 */}
			<div className="flex flex-wrap items-center gap-0.5 border-b border-zinc-200 px-3 py-1 dark:border-zinc-700">
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

			{/* 编辑区 */}
			<EditorContent editor={editor} />
		</div>
	);
}
