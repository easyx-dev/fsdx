/**
 * 编辑新闻页面
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import { message } from "#/components/antd-static";
import { NewsForm } from "../-mods/NewsForm";

export const Route = createFileRoute("/admin/_admin/news/$id/edit")({
	component: NewsEditPage,
});

function NewsEditPage() {
	const { id } = Route.useParams();
	const navigate = useNavigate();

	return (
		<AdminPageContent title="编辑新闻" description="修改新闻内容与发布状态">
			<div className="max-w-4xl">
				<NewsForm
					id={id}
					onSuccess={() => {
						message.success("新闻已更新");
						navigate({ to: "/admin/news" });
					}}
					onError={(err) => message.error(err.message)}
					onCancel={() => navigate({ to: "/admin/news" })}
				/>
			</div>
		</AdminPageContent>
	);
}
