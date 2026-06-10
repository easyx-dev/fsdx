/**
 * 编辑新闻页面
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Form, message } from "antd";
import { useEffect } from "react";
import { z } from "zod";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import { NewsForm, type NewsFormValues } from "#/components/admin/NewsForm";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import { getNewsById, updateNews } from "#/server/news/news.server";

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
	.middleware([adminPermGuard(PERMISSIONS.NEWS_VIEW)])
	.inputValidator(getSchema)
	.handler(async ({ data: { id } }) => {
		return getNewsById(id);
	});

const updateNewsFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.NEWS_EDIT)])
	.inputValidator(updateSchema)
	.handler(async ({ data }) => {
		return updateNews(data.id, data);
	});

export const Route = createFileRoute("/admin/_admin/news/$id/edit")({
	component: NewsEditPage,
	loader: async ({ params }) => getNewsFn({ data: { id: params.id } }),
});

function NewsEditPage() {
	const record = Route.useLoaderData();
	const navigate = useNavigate();
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

	const handleSubmit = async (values: NewsFormValues) => {
		try {
			await updateNewsFn({
				data: {
					id: record.id,
					title: values.title,
					slug: values.slug || undefined,
					summary: values.summary || undefined,
					content: values.content || undefined,
					status: values.status as "draft" | "published" | "archived",
					isPinned: values.isPinned || false,
				},
			});
			message.success("新闻已更新");
			navigate({ to: "/admin/news" });
		} catch (err) {
			message.error(err instanceof Error ? err.message : "保存失败");
		}
	};

	return (
		<AdminPageContent title="编辑新闻" description="修改新闻内容与发布状态">
			<div className="max-w-4xl">
				<NewsForm
					mode="edit"
					form={form}
					onSubmit={handleSubmit}
					onCancel={() => navigate({ to: "/admin/news" })}
				/>
			</div>
		</AdminPageContent>
	);
}
