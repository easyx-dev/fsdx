/**
 * AI Rich Editor（AI 富编辑器）演示页：三栏工作台（AI 对话 / 代码编辑 / 实时预览）
 * 演示独立包 @fsdx/ai-rich-editor 的接入方式：注入宿主 adapter（SSE 端点）+ notify
 */

import { AiRichEditor, DEFAULT_HTML, type AiRichEditorConfig } from "@fsdx/ai-rich-editor";
import { message } from "@fsdx/ui-spa/antd-static";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminPageContent } from "#/components/admin";
import { aiRichEditorAdapter } from "./-mods/ai-rich-editor.adapter";

export const Route = createFileRoute("/admin/_admin/demo/ai-rich-editor")({
	component: DemoPage,
});

// 稳定引用：config 为「仅初始值」，避免每次渲染新建对象造成误解
const demoEditorConfig: AiRichEditorConfig = {
	notify: (type, content) => {
		if (type === "success") message.success(content);
		else if (type === "error") message.error(content);
		else message.warning(content);
	},
};

function DemoPage() {
	const [html, setHtml] = useState(DEFAULT_HTML);

	return (
		<AdminPageContent
			title="AI Rich Editor 演示"
			description="左侧用 AI 对话生成/迭代页面，中间直接编辑 HTML，右侧实时预览（沙箱隔离）"
		>
			<AiRichEditor
				value={html}
				onChange={setHtml}
				adapter={aiRichEditorAdapter}
				height="calc(100vh - var(--admin-header-height) - 56px)"
				config={demoEditorConfig}
			/>
		</AdminPageContent>
	);
}
