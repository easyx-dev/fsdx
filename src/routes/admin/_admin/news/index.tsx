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
import {
	Button,
	Drawer,
	message,
	Popconfirm,
	Segmented,
	Space,
	Tag,
} from "antd";
import { useMemo, useState } from "react";
import { z } from "zod";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import { DictTag } from "#/components/admin/DictTag";
import { FieldTranslationDrawer } from "#/components/admin/FieldTranslationDrawer";
import { ProTable } from "#/components/admin/ProTable";
import { downloadFile } from "#/lib/export/export.utils";
import { useAdminDictStore } from "#/lib/global-store/admin-dict-store";
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
import { NewsForm } from "./-mods/NewsForm";

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
	loader: async () => getNewsListFn({ data: {} }),
});

const NEWS_TRANSLATABLE_FIELDS = [
	{ name: "title", label: "新闻标题", valueType: "input" as const },
	{ name: "summary", label: "新闻摘要", valueType: "text" as const },
	{ name: "content", label: "新闻内容", valueType: "rich" as const },
];

function NewsListPage() {
	const newsData = Route.useLoaderData();
	const [data, setData] = useState(newsData);
	const [filter, setFilter] = useState<string>("");

	/** 抽屉编辑状态 */
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [editingRecordId, setEditingRecordId] = useState<string | null>(null);

	const newsStatusOptions = useAdminDictStore((s) => s.dicts.news_status ?? []);

	const segmentedOptions = useMemo(
		() => [
			{ label: "全部", value: "" },
			...newsStatusOptions.map((o) => ({ label: o.label, value: o.value })),
		],
		[newsStatusOptions],
	);

	async function refresh(s?: string) {
		const status = s !== undefined ? s : filter;
		const result = await getNewsListFn({
			data: { status: status || undefined },
		});
		setData(result);
	}

	/** 打开抽屉编辑 */
	function handleQuickEdit(record: NewsRecord) {
		setEditingRecordId(record.id);
		setDrawerOpen(true);
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
			width: 140,
			render: (_: string, record: NewsRecord) => {
				return (
					<Space size={4}>
						<DictTag dictSlug="news_status" value={record.status ?? ""} />
						{record.isPinned && <Tag color="blue">置顶</Tag>}
					</Space>
				);
			},
		},
		{
			title: "发布时间",
			dataIndex: "publishedAt",
			key: "publishedAt",
			width: 130,
			render: (val: string | null) => (val ? formatDate(val, "zh-CN") : "—"),
		},
		{
			title: "创建时间",
			dataIndex: "createdAt",
			key: "createdAt",
			width: 130,
			type: "dateTime",
			render: (val: string | null) => (val ? formatDate(val, "zh-CN") : "—"),
		},
		{
			title: "更新时间",
			dataIndex: "updatedAt",
			key: "updatedAt",
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
					<Button
						type="link"
						size="small"
						onClick={() => handleQuickEdit(record)}
					>
						快速编辑
					</Button>
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
					options={segmentedOptions}
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

			<Drawer
				title="快速编辑新闻"
				open={drawerOpen}
				onClose={() => setDrawerOpen(false)}
				width={720}
				destroyOnClose
			>
				{editingRecordId && (
					<NewsForm
						id={editingRecordId}
						onSuccess={() => {
							message.success("新闻已更新");
							setDrawerOpen(false);
							refresh();
						}}
						onError={(err) => message.error(err.message)}
						onCancel={() => setDrawerOpen(false)}
					/>
				)}
			</Drawer>
		</AdminPageContent>
	);
}
