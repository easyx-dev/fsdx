/**
 * 新闻列表页（antd Table）
 */
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { App, Button, Popconfirm, Segmented, Space, Table, Tag } from "antd";
import { useState } from "react";
import { z } from "zod";
import { PERMISSIONS } from "#/lib/permissions";
import { permGuard } from "#/middleware/server-fn-auth";
import type { NewsRecord } from "#/server/news";
import {
	changeNewsStatus,
	deleteNews,
	getNewsList as getNewsListService,
} from "#/server/news";

const listSchema = z.object({
	status: z.string().optional(),
	page: z.number().optional(),
});
const idSchema = z.object({ id: z.string().min(1) });
const statusSchema = z.object({
	id: z.string().min(1),
	status: z.enum(["draft", "published", "archived"]),
});

const getNewsListFn = createServerFn({ method: "GET" })
	.middleware([permGuard(PERMISSIONS.NEWS_VIEW)])
	.inputValidator(listSchema)
	.handler(async ({ data: { status, page = 1 } }) => {
		return getNewsListService({ status, page, pageSize: 20 });
	});

const deleteNewsFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.NEWS_DELETE)])
	.inputValidator(idSchema)
	.handler(async ({ data: { id } }) => {
		await deleteNews(id);
		return { success: true };
	});

const changeStatusFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.NEWS_PUBLISH)])
	.inputValidator(statusSchema)
	.handler(async ({ data: { id, status } }) => {
		return changeNewsStatus(id, status);
	});

export const Route = createFileRoute("/admin/_admin/news/")({
	component: NewsListPage,
	loader: async () => await getNewsListFn({ data: {} }),
});

const STATUS_LABELS: Record<string, string> = {
	draft: "草稿",
	published: "已发布",
	archived: "已归档",
};

const STATUS_COLORS: Record<string, string> = {
	draft: "gold",
	published: "green",
	archived: "default",
};

function NewsListPage() {
	const initial = Route.useLoaderData();
	const [data, setData] = useState(initial);
	const [filter, setFilter] = useState<string>("");
	const { message } = App.useApp();

	async function refresh(s?: string) {
		const status = s !== undefined ? s : filter;
		const result = await getNewsListFn({
			data: { status: status || undefined },
		});
		setData(result);
	}

	const columns = [
		{
			title: "标题",
			dataIndex: "title",
			key: "title",
			render: (_: string, record: NewsRecord) => (
				<div>
					<div className="font-medium">{record.title}</div>
					<div className="text-xs text-muted-foreground">{record.slug}</div>
				</div>
			),
		},
		{
			title: "状态",
			dataIndex: "status",
			key: "status",
			width: 120,
			render: (_: string, record: NewsRecord) => (
				<Space size={4}>
					<Tag color={STATUS_COLORS[record.status ?? ""]}>
						{STATUS_LABELS[record.status ?? ""] || record.status}
					</Tag>
					{record.isPinned && <Tag color="blue">置顶</Tag>}
				</Space>
			),
		},
		{
			title: "发布时间",
			dataIndex: "publishedAt",
			key: "publishedAt",
			width: 130,
			render: (val: string | null) =>
				val ? new Date(val).toLocaleDateString("zh-CN") : "—",
		},
		{
			title: "操作",
			key: "actions",
			width: 200,
			render: (_: unknown, record: NewsRecord) => (
				<Space size={4}>
					{record.status === "draft" && (
						<Button
							type="link"
							size="small"
							onClick={async () => {
								await changeStatusFn({
									data: { id: record.id, status: "published" },
								});
								await refresh();
							}}
						>
							发布
						</Button>
					)}
					{record.status === "published" && (
						<Button
							type="link"
							size="small"
							onClick={async () => {
								await changeStatusFn({
									data: { id: record.id, status: "archived" },
								});
								await refresh();
							}}
						>
							归档
						</Button>
					)}
					<Link to="/admin/news/$id/edit" params={{ id: record.id }}>
						<Button type="link" size="small" icon={<EditOutlined />}>
							编辑
						</Button>
					</Link>
					<Popconfirm
						title="确定删除这条新闻？"
						onConfirm={async () => {
							await deleteNewsFn({ data: { id: record.id } });
							message.success("已删除");
							await refresh();
						}}
					>
						<Button type="link" size="small" danger icon={<DeleteOutlined />} />
					</Popconfirm>
				</Space>
			),
		},
	];

	return (
		<div>
			<div className="mb-4 flex items-center justify-between">
				<h1 className="text-2xl font-bold">新闻管理</h1>
				<Link to="/admin/news/create">
					<Button type="primary" icon={<PlusOutlined />}>
						新建新闻
					</Button>
				</Link>
			</div>

			<div className="mb-4">
				<Segmented
					options={[
						{ label: "全部", value: "" },
						{ label: "草稿", value: "draft" },
						{ label: "已发布", value: "published" },
						{ label: "已归档", value: "archived" },
					]}
					value={filter}
					onChange={(value) => {
						setFilter(value as string);
						refresh(value as string);
					}}
				/>
			</div>

			<Table
				dataSource={data.records}
				columns={columns}
				rowKey="id"
				pagination={{
					total: data.total,
					pageSize: data.pageSize,
					current: data.page,
					onChange: async (page) => {
						const result = await getNewsListFn({
							data: { status: filter || undefined, page },
						});
						setData(result);
					},
				}}
			/>
		</div>
	);
}
