/**
 * 新建新闻页面（antd Form + TipTap 编辑器）
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Button, Form, Input, message, Select, Switch } from "antd";
import { z } from "zod";
import { NewsEditor } from "#/components/admin/NewsEditor";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { permGuard } from "#/middleware/server-fn-auth";
import { createNews } from "#/server/news";

const createSchema = z.object({
	title: z.string().min(1, "标题不能为空").max(500),
	slug: z.string().max(500).optional(),
	summary: z.string().optional(),
	content: z.string().optional(),
	status: z.enum(["draft", "published"]).default("draft"),
	isPinned: z.boolean().default(false),
});

const createNewsFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.NEWS_CREATE)])
	.inputValidator(createSchema)
	.handler(async ({ data }) => {
		return createNews(data);
	});

export const Route = createFileRoute("/admin/_admin/news/create")({
	component: NewsCreatePage,
});

function NewsCreatePage() {
	const navigate = useNavigate();
	const [form] = Form.useForm();

	const handleSubmit = async (values: Record<string, unknown>) => {
		try {
			const record = await createNewsFn({
				data: {
					title: values.title as string,
					slug: (values.slug as string) || undefined,
					summary: (values.summary as string) || undefined,
					content: (values.content as string) || undefined,
					status: values.status as "draft" | "published",
					isPinned: (values.isPinned as boolean) || false,
				},
			});
			message.success("新闻创建成功");
			navigate({ to: "/admin/news/$id/edit", params: { id: record.id } });
		} catch (err) {
			message.error(err instanceof Error ? err.message : "保存失败");
		}
	};

	return (
		<div className="max-w-4xl">
			<h1 className="mb-6 text-2xl font-bold">新建新闻</h1>
			<Form
				form={form}
				layout="vertical"
				onFinish={handleSubmit}
				initialValues={{ status: "draft", isPinned: false, content: "" }}
			>
				<Form.Item
					name="title"
					label="标题"
					rules={[{ required: true, message: "请输入标题" }]}
				>
					<Input placeholder="新闻标题" />
				</Form.Item>

				<Form.Item name="slug" label="Slug" extra="留空自动生成">
					<Input placeholder="自动生成" style={{ fontFamily: "monospace" }} />
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

/** Form.Item 内嵌 TipTap 编辑器 */
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
