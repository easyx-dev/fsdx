/**
 * 编辑新闻页面（antd Form + TipTap 编辑器）
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Button, Form, Input, message, Select, Switch } from "antd";
import { useEffect } from "react";
import { z } from "zod";
import { NewsEditor } from "#/components/admin/NewsEditor";
import { PERMISSIONS } from "#/lib/permissions";
import { permGuard } from "#/middleware/server-fn-auth";
import { getNewsById, updateNews } from "#/server/news";

const getSchema = z.object({ id: z.string().min(1) });
const updateSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1).max(500),
	slug: z.string().max(500).optional(),
	summary: z.string().optional(),
	content: z.string().optional(),
	status: z.enum(["draft", "published", "archived"]),
	isPinned: z.boolean(),
});

const getNewsFn = createServerFn({ method: "GET" })
	.middleware([permGuard(PERMISSIONS.NEWS_VIEW)])
	.inputValidator(getSchema)
	.handler(async ({ data: { id } }) => {
		return getNewsById(id);
	});

const updateNewsFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.NEWS_EDIT)])
	.inputValidator(updateSchema)
	.handler(async ({ data }) => {
		return updateNews(data.id, data);
	});

export const Route = createFileRoute("/admin/_admin/news/$id/edit")({
	component: NewsEditPage,
	loader: async ({ params }) => await getNewsFn({ data: { id: params.id } }),
});

function NewsEditPage() {
	const navigate = useNavigate();
	const record = Route.useLoaderData();
	const [form] = Form.useForm();

	useEffect(() => {
		if (record) {
			form.setFieldsValue({
				title: record.title,
				slug: record.slug,
				summary: record.summary,
				content: record.content || "",
				status: record.status,
				isPinned: record.isPinned,
			});
		}
	}, [record, form]);

	if (!record) {
		return (
			<div className="py-12 text-center text-muted-foreground">新闻不存在</div>
		);
	}

	const handleSubmit = async (values: Record<string, unknown>) => {
		try {
			await updateNewsFn({
				data: {
					id: record.id,
					title: values.title as string,
					slug: (values.slug as string) || undefined,
					summary: (values.summary as string) || undefined,
					content: (values.content as string) || undefined,
					status: values.status as "draft" | "published" | "archived",
					isPinned: (values.isPinned as boolean) || false,
				},
			});
			message.success("新闻已更新");
			navigate({ to: "/admin/news" });
		} catch (err) {
			message.error(err instanceof Error ? err.message : "保存失败");
		}
	};

	return (
		<div className="max-w-4xl">
			<h1 className="mb-6 text-2xl font-bold">编辑新闻</h1>
			<Form form={form} layout="vertical" onFinish={handleSubmit}>
				<Form.Item
					name="title"
					label="标题"
					rules={[{ required: true, message: "请输入标题" }]}
				>
					<Input placeholder="新闻标题" />
				</Form.Item>
				<Form.Item name="slug" label="Slug">
					<Input placeholder="Slug" style={{ fontFamily: "monospace" }} />
				</Form.Item>
				<Form.Item name="summary" label="摘要">
					<Input.TextArea rows={2} placeholder="新闻摘要（可选）" />
				</Form.Item>
				<Form.Item name="content" label="正文">
					<NewsEditorInput />
				</Form.Item>
				<div className="flex gap-8">
					<Form.Item name="status" label="状态" className="min-w-28">
						<Select
							options={[
								{ label: "草稿", value: "draft" },
								{ label: "发布", value: "published" },
								{ label: "归档", value: "archived" },
							]}
						/>
					</Form.Item>
					<Form.Item name="isPinned" label="置顶" valuePropName="checked">
						<Switch />
					</Form.Item>
				</div>
				<Form.Item>
					<div className="flex gap-2">
						<Button type="primary" htmlType="submit">
							保存
						</Button>
						<Button onClick={() => navigate({ to: "/admin/news" })}>
							取消
						</Button>
					</div>
				</Form.Item>
			</Form>
		</div>
	);
}

function NewsEditorInput({
	value,
	onChange,
}: {
	value?: string;
	onChange?: (val: string) => void;
}) {
	return (
		<div className="rounded-md border border-border">
			<NewsEditor content={value || ""} onChange={onChange || (() => {})} />
		</div>
	);
}
