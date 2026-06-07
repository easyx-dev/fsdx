/**
 * TypeAwareEditor 组件演示页面
 * 展示六种编辑器类型在编辑和预览模式下的效果
 */
import { createFileRoute } from "@tanstack/react-router";
import { Card, Space, Switch, Typography } from "antd";
import { useState } from "react";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import { TypeAwareEditor } from "#/components/admin/TypeAwareEditor";
import type { EditorType } from "#/lib/editor-types";
import { EDITOR_TYPE_LABELS, EDITOR_TYPES } from "#/lib/editor-types";

const { Text } = Typography;

/** 每种编辑器的演示数据 */
const DEMO_VALUES: Record<EditorType, string | number> = {
	input: "这是一段输入框的演示文本",
	text: "这是多行文本域的演示内容。\n支持多行编辑。",
	number: 42,
	json: JSON.stringify(
		{ name: "演示配置", enabled: true, items: ["a", "b", "c"] },
		null,
		2,
	),
	code: 'function hello(name: string) {\n  console.log("Hello, " + name + "!");\n}\n\nhello("CMS");',
	rich: "<h2>富文本演示</h2><p>这是一段<strong>富文本</strong>内容，支持各种排版样式。</p><ul><li>列表项一</li><li>列表项二</li></ul>",
};

export const Route = createFileRoute("/admin/_admin/demo/")({
	component: DemoPage,
});

function DemoPage() {
	const [editValues, setEditValues] = useState(DEMO_VALUES);
	const [preview, setPreview] = useState(false);

	return (
		<AdminPageContent
			title="编辑器组件演示"
			description="演示 TypeAwareEditor 六种编辑器类型在编辑和预览模式下的表现"
			extra={
				<Space>
					<Text>编辑</Text>
					<Switch checked={preview} onChange={setPreview} />
					<Text>预览</Text>
				</Space>
			}
		>
			<div className="space-y-6 flex flex-col gap-4">
				{EDITOR_TYPES.map((type) => (
					<Card
						key={type}
						title={EDITOR_TYPE_LABELS[type]}
						size="small"
						styles={{ body: { padding: 16 } }}
					>
						<TypeAwareEditor
							type={type}
							value={editValues[type]}
							onChange={(v) =>
								setEditValues((prev) => ({ ...prev, [type]: v }))
							}
							language="typescript"
							preview={preview}
							placeholder={`请输入${EDITOR_TYPE_LABELS[type]}内容`}
						/>
					</Card>
				))}
			</div>
		</AdminPageContent>
	);
}
