/**
 * 新闻列表页（antd Table）
 */
import {
	DownloadOutlined,
	FileTextOutlined,
	PlusOutlined,
} from "@ant-design/icons";
import { downloadFile } from "@fsdx/core/export";
import { message } from "@fsdx/ui-spa/antd-static";
import { JsonImportButton } from "@fsdx/ui-spa/json-import-button";
import { ProTable } from "@fsdx/ui-spa/table";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button, Drawer, Segmented, Space } from "antd";
import type { SegmentedValue } from "antd/es/segmented";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { AdminPageContent, useAdminDictStore } from "#/components/admin";
import type { NewsRecord } from "#/services/news/news.server";
import { NewsForm } from "./-mods/NewsForm";
import {
	exportNewsSFn,
	getNewsListSFn,
	importNewsSFn,
} from "./-mods/news.functions";
import { newsColumns } from "./-mods/newsColumns";

export const Route = createFileRoute("/admin/_admin/news/")({
	component: NewsListPage,
	loader: async () => getNewsListSFn({ data: {} }),
});

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

	const columns = newsColumns({
		onRefresh: () => refresh(),
		onQuickEdit: handleQuickEdit,
	});

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
					onChange={(value: SegmentedValue) => {
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
