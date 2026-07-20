/**
 * 管理端仪表盘（antd Card + Statistic）
 */
import {
	DashboardOutlined,
	FileTextOutlined,
	SafetyOutlined,
	TeamOutlined,
} from "@ant-design/icons";
import { createFileRoute } from "@tanstack/react-router";
import { Card, Col, Row, Statistic } from "antd";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import { getStatsSFn } from "./index.functions";

export const Route = createFileRoute("/admin/_admin/")({
	component: Dashboard,
	loader: async () => {
		try {
			return await getStatsSFn();
		} catch (err) {
			console.error("[dashboard]", (err as Error).message);
			return {
				newsTotal: 0,
				publishedNews: 0,
				adminTotal: 0,
				clientTotal: 0,
				storageTotal: 0,
			};
		}
	},
});

function formatStorage(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024)
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function Dashboard() {
	const stats = Route.useLoaderData();

	const statItems = [
		{
			title: "新闻总数",
			value: stats.newsTotal,
			suffix: `已发布 ${stats.publishedNews} 篇`,
			icon: <FileTextOutlined />,
			color: "#1677ff",
		},
		{
			title: "管理员",
			value: stats.adminTotal,
			icon: <SafetyOutlined />,
			color: "#722ed1",
		},
		{
			title: "客户端用户",
			value: stats.clientTotal,
			icon: <TeamOutlined />,
			color: "#52c41a",
		},
		{
			title: "存储用量",
			value: formatStorage(stats.storageTotal),
			icon: <DashboardOutlined />,
			color: "#fa8c16",
		},
	];

	return (
		<AdminPageContent title="仪表盘">
			<Row gutter={[16, 16]}>
				{statItems.map((item) => (
					<Col key={item.title} xs={24} sm={12} lg={6}>
						<Card>
							<div className="flex items-center justify-between">
								<Statistic title={item.title} value={item.value} />
								<div
									className="flex h-12 w-12 items-center justify-center rounded-lg text-xl text-white"
									style={{ backgroundColor: item.color }}
								>
									{item.icon}
								</div>
							</div>
							{item.suffix && (
								<div className="mt-2 text-xs text-muted-foreground">
									{item.suffix}
								</div>
							)}
						</Card>
					</Col>
				))}
			</Row>
		</AdminPageContent>
	);
}
