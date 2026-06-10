/**
 * 新闻列表页（antd Table）
 */
import {
	DeleteOutlined,
	DownloadOutlined,
	EditOutlined,
	FileTextOutlined,
	PlusOutlined,
} from "@ant-design/icons";
import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { Button, message, Popconfirm, Segmented, Space, Tag } from "antd";
import { useState } from "react";
import { z } from "zod";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import { FieldTranslationDrawer } from "#/components/admin/FieldTranslationDrawer";
import { ProTable } from "#/components/admin/ProTable";
import {
	NEWS_STATUS_COLORS,
	NEWS_STATUS_LABELS,
} from "#/lib/constants/admin-constants";
import { downloadFile } from "#/lib/export/export.utils";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { formatDate } from "#/lib/utils/format-date";
import { adminPermGuard } from "#/middleware/admin-auth";
import { exportNewsFn } from "#/server/news/news.functions";
import type { NewsRecord } from "#/server/news/news.server";
import {
	changeNewsStatus,
	deleteNews,
	getNewsList,
} from "#/server/news/news.server";

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
	.middleware([adminPermGuard(PERMISSIONS.NEWS_VIEW)])
	.inputValidator(listSchema)
	.handler(async ({ data: { status, page = 1 } }) => {
		return getNewsList({ status, page, pageSize: 20 });
	});

const deleteNewsFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.NEWS_DELETE)])
	.inputValidator(idSchema)
	.handler(async ({ data: { id } }) => {
		await deleteNews(id);
		return { success: true };
	});

const changeStatusFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.NEWS_PUBLISH)])
	.inputValidator(statusSchema)
	.handler(async ({ data: { id, status } }) => {
		return changeNewsStatus(id, status);
	});

export const Route = createFileRoute("/admin/_admin/news/")({
	component: NewsListPage,
	loader: async () => await getNewsListFn({ data: {} }),
});

const NEWS_TRANSLATABLE_FIELDS = [
	{ name: "title", label: "新闻标题", valueType: "input" as const },
	{ name: "summary", label: "新闻摘要", valueType: "text" as const },
	{ name: "content", label: "新闻内容", valueType: "rich" as const },
];

function NewsListPage() {
	const initial = Route.useLoaderData();
	const [data, setData] = useState(initial);
	const [filter, setFilter] = useState<string>("");

	async function refresh(s?: string) {
		const status = s !== undefined ? s : filter;
		const result = await getNewsListFn({
			data: { status: status || undefined },
		});
		setData(result);
	}

	/** 导出新闻数据 */
	async function handleExport(format: "csv" | "json") {
		const result = await exportNewsFn({ data: { format } });
		const timestamp = new Date().toISOString().slice(0, 10);
		const ext = format === "csv" ? "csv" : "json";
		const mime =
			format === "csv" ? "text/csv;charset=utf-8" : "application/json";
		downloadFile(result.content, `news_export_${timestamp}.${ext}`, mime);
		message.success("导出完成");
	}

	const columns = [
		{
			title: "标题",
			dataIndex: "title",
			key: "title",
			width: 200,
		},
		{
			title: "摘要",
			dataIndex: "summary",
			key: "summary",
			width: 200,
			ellipsis: true,
		},
		{
			title: "状态",
			dataIndex: "status",
			key: "status",
			width: 100,
			render: (_: string, record: NewsRecord) => (
				<Space size={4}>
					<Tag color={NEWS_STATUS_COLORS[record.status ?? ""]}>
						{NEWS_STATUS_LABELS[record.status ?? ""] || record.status}
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
			render: (val: string | null) => (val ? formatDate(val, "zh-CN") : "—"),
		},
		{
			title: "操作",
			key: "actions",
			render: (_: unknown, record: NewsRecord) => (
				<Space size={4}>
					<FieldTranslationDrawer
						entityType="news"
						entityId={record.id}
						fields={NEWS_TRANSLATABLE_FIELDS}
						trigger="button"
						originalValues={{
							title: record.title ?? "",
							summary: record.summary ?? "",
							content: record.content ?? "",
						}}
					/>
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
		<AdminPageContent
			title="新闻管理"
			extra={
				<Space>
					<Button
						icon={<DownloadOutlined />}
						onClick={() => handleExport("csv")}
					>
						导出 CSV
					</Button>
					<Button
						icon={<FileTextOutlined />}
						onClick={() => handleExport("json")}
					>
						导出 JSON
					</Button>
					<Link to="/admin/news/create">
						<Button type="primary" icon={<PlusOutlined />}>
							新建新闻
						</Button>
					</Link>
				</Space>
			}
		>
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

			<ProTable
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
		</AdminPageContent>
	);
}
