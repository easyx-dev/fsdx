/**
 * AI Rich Editor（AI 富编辑器）演示页：三栏工作台（AI 对话 / 代码编辑 / 实时预览）
 * 演示独立包 @fsdx/ai-rich-editor 的接入方式：注入 SSE 端点（/api/ai-chat）+ notify + 厂商选择
 */

import {
	AiRichEditor,
	type AiRichEditorConfig,
	DEFAULT_HTML,
} from "@fsdx/ai-rich-editor";
import { message } from "@fsdx/ui-spa/antd-static";
import { createFileRoute } from "@tanstack/react-router";
import { Select } from "antd";
import { useMemo, useState } from "react";
import { AdminPageContent } from "#/components/admin";
import type { AiProviderView } from "#/services/ai/ai.schemas";
import { getAiProvidersSFn } from "#/services/ai/ai-providers.functions";

export const Route = createFileRoute("/admin/_admin/demo/ai-rich-editor")({
	loader: async () => {
		try {
			return await getAiProvidersSFn();
		} catch {
			return [];
		}
	},
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
	const providers = Route.useLoaderData() as AiProviderView[];
	const [providerId, setProviderId] = useState<string | undefined>(
		providers.find((p) => p.default)?.id ?? providers[0]?.id,
	);

	const providerOptions = useMemo(
		() =>
			providers.map((p) => ({
				value: p.id,
				label: p.name,
			})),
		[providers],
	);

	return (
		<AdminPageContent
			title="AI Rich Editor 演示"
			description="左侧用 AI 对话生成/迭代页面，中间直接编辑 HTML，右侧实时预览（沙箱隔离）"
		>
			<div className="mb-2 flex items-center gap-2">
				{providerOptions.length > 0 && (
					<Select
						value={providerId}
						options={providerOptions}
						onChange={setProviderId}
						placeholder="选择 AI 厂商"
						className="w-48"
					/>
				)}
			</div>
			<AiRichEditor
				value={html}
				onChange={setHtml}
				endpointUrl="/api/ai-chat"
				requestMeta={{ providerId }}
				height="calc(100vh - var(--admin-header-height) - 110px)"
				config={demoEditorConfig}
			/>
		</AdminPageContent>
	);
}
