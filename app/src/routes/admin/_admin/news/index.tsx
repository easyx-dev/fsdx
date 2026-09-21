/**
 * 新闻列表页
 * 新建 / 编辑统一走抽屉，发布状态与排序权重在单元格内直接修改
 */
import {
	DownloadOutlined,
	FileTextOutlined,
	PlusOutlined,
} from "@ant-design/icons";
import { downloadFile } from "@fsdx/lib/export";
import { message } from "@fsdx/ui-spa/antd-static";
import { JsonImportButton } from "@fsdx/ui-spa/json-import-button";
import { ProTable, withDisabledReason } from "@fsdx/ui-spa/table";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "antd";
import dayjs from "dayjs";
import { useCallback, useState } from "react";
import {
	AdminFormDrawer,
	AdminListPage,
	AdminTableToolbar,
	FORM_DRAWER_WIDTH,
	PublishedFilter,
	type PublishedFilterValue,
	toIsPublished,
	useAdminAuth,
} from "#/components/admin";
import { ADMIN_PERMISSIONS } from "#/permissions/admin-permissions";
import type { NewsRecord } from "#/services/news/news.server";
import { callSfn, sfnUnwrap } from "#/utils/sfn-error";
import { useListQuery } from "#/utils/use-list-query";
import { NewsForm } from "./-mods/NewsForm";
import {
	deleteNewsSFn,
	exportNewsSFn,
	getNewsListSFn,
	importNewsSFn,
	setNewsPublishedSFn,
	updateNewsSortSFn,
} from "./-mods/news.functions";
import { newsColumns } from "./-mods/newsColumns";

/** 表单 <form id>：抽屉底部按钮据此触发提交 */
const FORM_ID = "news-form";
const NO_CREATE_PERMISSION = "无「新建新闻」权限";

/** 列表筛选条件 */
interface NewsFilters {
	published: PublishedFilterValue;
}

export const Route = createFileRoute("/admin/_admin/news/")({
	component: NewsListPage,
	loader: async () => getNewsListSFn({ data: {} }),
});

function NewsListPage() {
	const initialData = Route.useLoaderData();
	const { hasPermission } = useAdminAuth();
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const list = useListQuery<NewsRecord, NewsFilters>({
		initial: initialData,
		initialFilters: { published: "" },
		errorMessage: "加载列表失败",
		fetcher: useCallback(
			({ page, pageSize, sortField, sortOrder, filters }) =>
				getNewsListSFn({
					data: {
						isPublished: toIsPublished(filters.published),
						sortField,
						sortOrder,
						page,
						pageSize,
					},
				}),
			[],
		),
	});

	const permissions = {
		create: hasPermission(ADMIN_PERMISSIONS.NEWS_CREATE),
		edit: hasPermission(ADMIN_PERMISSIONS.NEWS_EDIT),
		publish: hasPermission(ADMIN_PERMISSIONS.NEWS_PUBLISH),
		delete: hasPermission(ADMIN_PERMISSIONS.NEWS_DELETE),
	};

	/** 单元格内切换发布状态 */
	const handleTogglePublished = async (record: NewsRecord, next: boolean) => {
		await callSfn(
			setNewsPublishedSFn({ data: { id: record.id, isPublished: next } }),
		);
		message.success(next ? "已发布" : "已下线");
		await list.reload();
	};

	/** 单元格内修改排序权重 */
	const handleChangeSortOrder = async (record: NewsRecord, next: number) => {
		await callSfn(
			updateNewsSortSFn({ data: { id: record.id, sortOrder: next } }),
		);
		message.success("排序已更新");
		await list.reload();
	};

	/** 删除（失败由统一出口提示） */
	const handleDelete = async (record: NewsRecord) => {
		const [, err] = await sfnUnwrap(
			deleteNewsSFn({ data: { id: record.id } }),
			{
				error: "删除失败",
			},
		);
		if (err) return;
		message.success("已删除");
		await list.reload();
	};

	/** 导出新闻数据 */
	const handleExport = async (format: "csv" | "json") => {
		const [result] = await sfnUnwrap(exportNewsSFn({ data: { format } }), {
			error: "导出失败",
		});
		if (!result) return;
		const timestamp = dayjs().format("YYYY-MM-DD");
		const ext = format === "csv" ? "csv" : "json";
		const mime =
			format === "csv" ? "text/csv;charset=utf-8" : "application/json";
		downloadFile(result.content, `news_export_${timestamp}.${ext}`, mime);
		message.success("导出完成");
	};

	const openCreate = () => {
		setEditingId(null);
		setDrawerOpen(true);
	};

	const columns = newsColumns({
		sortProps: list.sortProps,
		onEdit: (record) => {
			setEditingId(record.id);
			setDrawerOpen(true);
		},
		onTogglePublished: handleTogglePublished,
		onChangeSortOrder: handleChangeSortOrder,
		onDelete: handleDelete,
		permissions,
	});

	return (
		<AdminListPage
			title="新闻管理"
			description="发布状态与排序可在列表内直接修改"
			extra={withDisabledReason(
				<Button
					type="primary"
					icon={<PlusOutlined />}
					disabled={!permissions.create}
					onClick={openCreate}
				>
					新建新闻
				</Button>,
				!permissions.create,
				NO_CREATE_PERMISSION,
			)}
			toolbar={
				<AdminTableToolbar
					extra={
						<>
							<JsonImportButton
								onImport={async (jsonString) => {
									const data = JSON.parse(jsonString);
									const result = await callSfn(importNewsSFn({ data }));
									const msg = `新增 ${result.created} 条`;
									if (result.skipped > 0) {
										message.success(
											`${msg}，跳过 ${result.skipped} 条（标题重复）`,
										);
									} else {
										message.success(msg);
									}
									await list.reload();
								}}
							>
								导入 JSON
							</JsonImportButton>
							<Button
								icon={<DownloadOutlined />}
								onClick={() => void handleExport("csv")}
							>
								导出 CSV
							</Button>
							<Button
								icon={<FileTextOutlined />}
								onClick={() => void handleExport("json")}
							>
								导出 JSON
							</Button>
						</>
					}
				>
					<PublishedFilter
						value={list.filters.published}
						labels={{ published: "已发布", unpublished: "未发布" }}
						onChange={(published) => list.applyFilters({ published })}
					/>
				</AdminTableToolbar>
			}
		>
			<ProTable
				dataSource={list.data.records}
				columns={columns}
				rowKey="id"
				loading={list.loading}
				locale={{ emptyText: "暂无新闻" }}
				scroll={{ x: 1540 }}
				onChange={list.onTableChange}
				pagination={list.pagination}
			/>

			<AdminFormDrawer
				open={drawerOpen}
				onClose={() => setDrawerOpen(false)}
				entityName="新闻"
				id={editingId}
				formId={FORM_ID}
				submitting={submitting}
				width={FORM_DRAWER_WIDTH.full}
			>
				<NewsForm
					id={editingId ?? undefined}
					formId={FORM_ID}
					hideActions
					onSubmittingChange={setSubmitting}
					onSuccess={() => {
						message.success(editingId ? "新闻已更新" : "新闻已创建");
						setDrawerOpen(false);
						void list.reload();
					}}
					// 记录已不存在（别处删除 / 行数据过期）时给出提示并收起抽屉，避免编辑态空表单
					onError={() => {
						message.error("新闻不存在或已被删除");
						setDrawerOpen(false);
						void list.reload();
					}}
					onCancel={() => setDrawerOpen(false)}
				/>
			</AdminFormDrawer>
		</AdminListPage>
	);
}
