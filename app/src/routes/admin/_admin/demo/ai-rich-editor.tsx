/**
 * AI Rich Editor（AI 富编辑器）演示页：三栏工作台（AI 对话 / 代码编辑 / 实时预览）
 * 演示独立 npm 包 @easyx/ai-rich-editor 的接入方式：chat 传已鉴权的 OpenAI 兼容端点（/api/ai-chat）
 * 该包为纯客户端重组件（内含 monaco-editor 顶层访问 window），经 ClientOnly + 动态 import 隔离，
 * 服务端不引入包体（否则 SSR 入口加载即崩），包内默认值也延迟到客户端取用
 */

import { message } from "@fsdx/ui-spa/antd-static";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Select } from "antd";
import { lazy, Suspense, useMemo, useState } from "react";
import { AdminPageContent } from "#/components/admin";
import type { AiProviderView } from "#/shared-services/ai/ai.schemas";
import { getAiProvidersSFn } from "#/shared-services/ai/ai-providers.functions";

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

// 稳定引用：消息提示与错误上报为宿主能力，不随渲染变化
const notifyEditor = (
	type: "success" | "warning" | "error",
	content: string,
) => {
	if (type === "success") message.success(content);
	else if (type === "error") message.error(content);
	else message.warning(content);
};

/** 错误上报：包内已另行 `onNotify('error', …)` 呈现给用户，这里只留诊断日志 */
const reportEditorError = (error: Error) => {
	console.error("[AI 富编辑器]", error);
};

/** 工作台高度：占满管理端内容区 */
const EDITOR_HEIGHT = "calc(100vh - var(--admin-header-height) - 110px)";

/** 富文本工作台宿主：整块客户端懒加载，内容状态与包内默认值都随包体在客户端就绪 */
const LazyAiRichEditor = lazy(async () => {
	const { AiRichEditor, DEFAULT_HTML } = await import("@easyx/ai-rich-editor");

	function AiRichEditorHost({ providerId }: { providerId?: string }) {
		const [html, setHtml] = useState(DEFAULT_HTML);
		// 厂商选择经查询串透传（OpenAI 协议体不携带该信息），缺省用默认厂商
		const chat = providerId
			? `/api/ai-chat?providerId=${encodeURIComponent(providerId)}`
			: "/api/ai-chat";
		return (
			<AiRichEditor
				value={html}
				onChange={setHtml}
				chat={chat}
				height={EDITOR_HEIGHT}
				onNotify={notifyEditor}
				onError={reportEditorError}
			/>
		);
	}

	return { default: AiRichEditorHost };
});

/** 编辑器加载中占位（SSR 与懒加载阶段共用） */
function EditorLoading() {
	return (
		<div
			className="flex items-center justify-center rounded-md border border-border bg-background-secondary text-muted-foreground text-sm"
			style={{ height: EDITOR_HEIGHT }}
		>
			富文本工作台加载中...
		</div>
	);
}

function DemoPage() {
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
			<ClientOnly fallback={<EditorLoading />}>
				<Suspense fallback={<EditorLoading />}>
					<LazyAiRichEditor providerId={providerId} />
				</Suspense>
			</ClientOnly>
		</AdminPageContent>
	);
}
