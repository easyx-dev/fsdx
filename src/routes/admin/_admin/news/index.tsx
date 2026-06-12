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
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { z } from "zod";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import { DictTag } from "#/components/admin/DictTag";
import { FieldTranslationDrawer } from "#/components/admin/FieldTranslationDrawer";
import { ProTable } from "#/components/admin/ProTable";
import { downloadFile } from "#/lib/export/export.utils";
import { useAdminDictStore } from "#/lib/global-store/admin-dict-store";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { formatDateTime } from "#/lib/utils/format-date";
import { adminPermGuard } from "#/middleware/admin-auth";
import { exportNewsSFn } from "#/server/news/news.functions";
import type { NewsRecord } from "#/server/news/news.server";
import {
	changeNewsStatus,
	deleteNews,
	getNewsById,
	getNewsList,
} from "#/server/news/news.server";
import { logOperation } from "#/server/operation-log/operation-log.server";
import { NewsForm } from "./-mods/NewsForm";

const listSchema = z.object({
	status: z.string().optional(),
	page: z.number().optional(),
	sortField: z.string().optional(),
	sortOrder: z.enum(["ascend", "descend"]).optional(),
});
const idSchema = z.object({ id: z.string().min(1) });
const statusSchema = z.object({
	id: z.string().min(1),
	status: z.enum(["draft", "published", "archived"]),
});

const getNewsListSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.NEWS_VIEW)])
	.inputValidator(listSchema)
	.handler(async ({ data: { status, page = 1, sortField, sortOrder } }) => {
		return getNewsList({ status, page, pageSize: 20, sortField, sortOrder });
	});

const deleteNewsSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.NEWS_DELETE)])
	.inputValidator(idSchema)
	.handler(async ({ data: { id }, context }) => {
		const newsRecord = await getNewsById(id);
		await deleteNews(id);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "news",
			action: "delete",
			targetType: "news",
			targetId: id,
			targetName: newsRecord?.title ?? id,
		});
		return { success: true };
	});

const changeStatusSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.NEWS_PUBLISH)])
	.inputValidator(statusSchema)
	.handler(async ({ data: { id, status }, context }) => {
		const newsRecord = await getNewsById(id);
		const result = await changeNewsStatus(id, status);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "news",
			action: "change_status",
			targetType: "news",
			targetId: id,
			targetName: newsRecord?.title || id,
		});
		return result;
	});

export const Route = createFileRoute("/admin/_admin/news/")({
	component: NewsListPage,
	loader: async () => getNewsListSFn({ data: {} }),
});

const NEWS_TRANSLATABLE_FIELDS = [
	{ name: "title", label: "新闻标题", valueType: "input" as const },
	{ name: "description", label: "新闻摘要", valueType: "text" as const },
	{ name: "content", label: "新闻内容", valueType: "rich" as const },
];

function NewsListPage() {
	const newsData = Route.useLoaderData();
	const [data, setData] = useState(newsData);
	const [filter, setFilter] = useState<string>("");
	const [sortField, setSortField] = useState<string | undefined>();
	const [sortOrder, setSortOrder] = useState<
		"ascend" | "descend" | undefined
	>();

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

	async function refresh(s?: string, sf?: string, so?: string) {
		try {
			const status = s !== undefined ? s : filter;
			const field = sf !== undefined ? sf : sortField;
			const order = so !== undefined ? so : sortOrder;
			const result = await getNewsListSFn({
				data: {
					status: status || undefined,
					sortField: field,
					sortOrder: order as "ascend" | "descend" | undefined,
				},
			});
			setData(result);
		} catch (err) {
			message.error(err instanceof Error ? err.message : "加载新闻列表失败");
		}
	}

	/** 表格排序变更 */
	const handleTableChange = async (
		_pagination: unknown,
		_filters: unknown,
		sorter: unknown,
	) => {
		const s = sorter as { field?: string; order?: string };
		setSortField(s.field);
		setSortOrder(s.order as "ascend" | "descend" | undefined);
		await refresh(undefined, s.field, s.order);
	};

	/** 打开抽屉编辑 */
	function handleQuickEdit(record: NewsRecord) {
		setEditingRecordId(record.id);
		setDrawerOpen(true);
	}

	/** 导出新闻数据 */
	async function handleExport(format: "csv" | "json") {
		try {
			const result = await exportNewsSFn({ data: { format } });
			const timestamp = dayjs().format("YYYY-MM-DD");
			const ext = format === "csv" ? "csv" : "json";
			const mime =
				format === "csv" ? "text/csv;charset=utf-8" : "application/json";
			downloadFile(result.content, `news_export_${timestamp}.${ext}`, mime);
			message.success("导出完成");
		} catch (err) {
			message.error(err instanceof Error ? err.message : "导出失败");
		}
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
			dataIndex: "description",
			key: "description",
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
			title: "排序",
			dataIndex: "sortOrder",
			key: "sortOrder",
			width: 90,
			sorter: true,
		},
		{
			title: "发布时间",
			dataIndex: "publishedAt",
			key: "publishedAt",
			width: 160,
			sorter: true,
			render: (val: string | null) =>
				val ? dayjs(val).format("YYYY-MM-DD HH:mm") : "—",
		},
		{
			title: "创建时间",
			dataIndex: "createdAt",
			key: "createdAt",
			width: 160,
			sorter: true,
			render: (val: string | null) =>
				val ? formatDateTime(val, "zh-CN") : "—",
		},
		{
			title: "更新时间",
			dataIndex: "updatedAt",
			key: "updatedAt",
			width: 160,
			sorter: true,
			render: (val: string | null) =>
				val ? formatDateTime(val, "zh-CN") : "—",
		},
		{
			title: "操作",
			key: "actions",
			fixed: "right" as const,
			render: (_: unknown, record: NewsRecord) => (
				<Space size={4}>
					<FieldTranslationDrawer
						entityType="news"
						entityId={record.id}
						fields={NEWS_TRANSLATABLE_FIELDS}
						trigger="button"
						originalValues={{
							title: record.title ?? "",
							description: record.description ?? "",
							content: record.content ?? "",
						}}
					/>
					{record.status === "draft" && (
						<Button
							type="link"
							size="small"
							onClick={async () => {
								try {
									await changeStatusSFn({
										data: { id: record.id, status: "published" },
									});
									await refresh();
								} catch (err) {
									message.error(
										err instanceof Error ? err.message : "发布失败",
									);
								}
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
								try {
									await changeStatusSFn({
										data: { id: record.id, status: "archived" },
									});
									await refresh();
								} catch (err) {
									message.error(
										err instanceof Error ? err.message : "归档失败",
									);
								}
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
							try {
								await deleteNewsSFn({ data: { id: record.id } });
								message.success("已删除");
								await refresh();
							} catch (err) {
								message.error(err instanceof Error ? err.message : "删除失败");
							}
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
				onChange={handleTableChange}
				scroll={{ x: 1450 }}
				pagination={{
					total: data.total,
					pageSize: data.pageSize,
					current: data.page,
					onChange: async (page) => {
						try {
							const result = await getNewsListSFn({
								data: {
									status: filter || undefined,
									page,
									sortField,
									sortOrder,
								},
							});
							setData(result);
						} catch (err) {
							message.error(
								err instanceof Error ? err.message : "加载新闻列表失败",
							);
						}
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
