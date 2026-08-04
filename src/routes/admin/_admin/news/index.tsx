/**
 * 新闻列表页（antd Table）
 */
import {
	DownloadOutlined,
	FileTextOutlined,
	PlusOutlined,
} from "@ant-design/icons";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, Drawer, Image, Segmented, Space, Tag } from "antd";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import { DictTag } from "#/components/admin/DictTag";
import { FieldTranslationDrawer } from "#/components/admin/FieldTranslationDrawer";
import { JsonImportButton } from "#/components/admin/JsonImportButton";
import { ProTable } from "#/components/admin/ProTable";
import { TableOperate } from "#/components/admin/TableOperate";
import { message } from "#/components/antd-static";
import { downloadFile } from "#/lib/export/export.utils";
import { useAdminDictStore } from "#/lib/global-store/admin-dict-store";
import type { NewsRecord } from "#/services/news/news.server";
import { NewsForm } from "./-mods/NewsForm";
import {
	changeStatusSFn,
	deleteNewsSFn,
	exportNewsSFn,
	getNewsListSFn,
	importNewsSFn,
} from "./-mods/news.functions";

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
			title: "封面",
			key: "cover",
			width: 80,
			render: (_: unknown, record: NewsRecord) => {
				if (!record.coverImageId)
					return <span style={{ color: "#5A6478" }}>—</span>;
				return (
					<Image
						src={`/api/download/file/${record.coverImageId}`}
						width={60}
						height={40}
						style={{ objectFit: "cover", borderRadius: 4 }}
					/>
				);
			},
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
						{record.isRecommended && <Tag color="gold">推荐</Tag>}
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
			title: "类型",
			key: "type",
			width: 90,
			render: (_: unknown, record: NewsRecord) => {
				if (record.externalUrl) return <Tag color="cyan">外部链接</Tag>;
				return <Tag color="green">内部文章</Tag>;
			},
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
				val ? dayjs(val).format("YYYY-MM-DD HH:mm") : "—",
		},
		{
			title: "更新时间",
			dataIndex: "updatedAt",
			key: "updatedAt",
			width: 160,
			sorter: true,
			render: (val: string | null) =>
				val ? dayjs(val).format("YYYY-MM-DD HH:mm") : "—",
		},
		{
			title: "操作",
			key: "actions",
			fixed: "right" as const,
			render: (_: unknown, record: NewsRecord) => (
				<TableOperate>
					{record.status === "draft" && (
						<TableOperate.Custom>
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
						</TableOperate.Custom>
					)}
					{record.status === "published" && (
						<TableOperate.Custom>
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
						</TableOperate.Custom>
					)}
					<TableOperate.Link
						to="/admin/news/$id/edit"
						params={{ id: record.id }}
					/>
					<TableOperate.Custom>
						<Button
							type="link"
							size="small"
							onClick={() => handleQuickEdit(record)}
						>
							快速编辑
						</Button>
					</TableOperate.Custom>
					<TableOperate.Delete
						recordName="这条新闻"
						onConfirm={async () => {
							try {
								await deleteNewsSFn({ data: { id: record.id } });
								message.success("已删除");
								await refresh();
							} catch (err) {
								message.error(err instanceof Error ? err.message : "删除失败");
							}
						}}
					/>
					<TableOperate.Custom>
						<FieldTranslationDrawer
							entityType="news"
							entityId={record.id}
							fields={NEWS_TRANSLATABLE_FIELDS}
							originalValues={{
								title: record.title ?? "",
								description: record.description ?? "",
								content: record.content ?? "",
							}}
						/>
					</TableOperate.Custom>
				</TableOperate>
			),
		},
	];

	return (
		<AdminPageContent
			title="新闻管理"
			extra={
				<Space>
					<JsonImportButton
						onImport={async (jsonString) => {
							const data = JSON.parse(jsonString);
							const result = await importNewsSFn({ data });
							const msg = `新增 ${result.created} 条`;
							if (result.skipped > 0) {
								message.success(
									`${msg}，跳过 ${result.skipped} 条（标题重复）`,
								);
							} else {
								message.success(msg);
							}
							await refresh();
						}}
					>
						导入 JSON
					</JsonImportButton>
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
				scroll={{ x: 1660 }}
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
