/**
 * 新建新闻页面
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import { message } from "#/components/antd-static";
import { NewsForm } from "./-mods/NewsForm";

export const Route = createFileRoute("/admin/_admin/news/create")({
	component: NewsCreatePage,
});

function NewsCreatePage() {
	const navigate = useNavigate();

	return (
		<AdminPageContent title="新建新闻" description="创建一篇新的新闻文章">
			<div className="max-w-4xl">
				<NewsForm
					onSuccess={(recordId) => {
						message.success("新闻创建成功");
						navigate({ to: "/admin/news/$id/edit", params: { id: recordId } });
					}}
					onError={(err) => message.error(err.message)}
					onCancel={() => navigate({ to: "/admin/news" })}
				/>
			</div>
		</AdminPageContent>
	);
}
