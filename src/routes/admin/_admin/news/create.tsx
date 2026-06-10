/**
 * 新建新闻页面
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Form, message } from "antd";
import { z } from "zod";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import { NewsForm, type NewsFormValues } from "#/components/admin/NewsForm";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import { createNews } from "#/server/news/news.server";

const createSchema = z.object({
	title: z.string().min(1, "标题不能为空").max(500),
	slug: z.string().max(500).optional(),
	summary: z.string().optional(),
	content: z.string().optional(),
	status: z.enum(["draft", "published"]).default("draft"),
	isPinned: z.boolean().default(false),
});

const createNewsFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.NEWS_CREATE)])
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

	const handleSubmit = async (values: NewsFormValues) => {
		try {
			const record = await createNewsFn({
				data: {
					title: values.title,
					slug: values.slug || undefined,
					summary: values.summary || undefined,
					content: values.content || undefined,
					status: values.status as "draft" | "published",
					isPinned: values.isPinned || false,
				},
			});
			message.success("新闻创建成功");
			navigate({ to: "/admin/news/$id/edit", params: { id: record.id } });
		} catch (err) {
			message.error(err instanceof Error ? err.message : "保存失败");
		}
	};

	return (
		<AdminPageContent title="新建新闻" description="创建一篇新的新闻文章">
			<div className="max-w-4xl">
				<NewsForm
					mode="create"
					form={form}
					initialValues={{ status: "draft", isPinned: false, content: "" }}
					onSubmit={handleSubmit}
					onCancel={() => navigate({ to: "/admin/news" })}
				/>
			</div>
		</AdminPageContent>
	);
}
