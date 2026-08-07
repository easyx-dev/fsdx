/**
 * 新闻管理表格列定义（含发布/归档、翻译操作）
 */
import { message } from "@fsdx/ui-spa/antd-static";
import { TableOperate } from "@fsdx/ui-spa/table";
import { Button, Image, Space, Tag } from "antd";
import dayjs from "dayjs";
import { DictTag, FieldTranslationDrawer } from "#/components/admin";
import type { NewsRecord } from "#/services/news/news.server";
import { changeStatusSFn, deleteNewsSFn } from "./news.functions";

/** 新闻可翻译字段定义 */
const NEWS_TRANSLATABLE_FIELDS = [
	{ name: "title", label: "新闻标题", valueType: "input" as const },
	{ name: "description", label: "新闻摘要", valueType: "text" as const },
	{ name: "content", label: "新闻内容", valueType: "rich" as const },
];

interface NewsColumnsOptions {
	onRefresh: () => Promise<void>;
	onQuickEdit: (record: NewsRecord) => void;
}

/** 新闻表格列：状态标签、发布/归档、跳转编辑、快速编辑、翻译 */
export function newsColumns(options: NewsColumnsOptions) {
	return [
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
						style={{ objectFit: "cover", borderRadius: 0 }}
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
										await options.onRefresh();
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
										await options.onRefresh();
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
							onClick={() => options.onQuickEdit(record)}
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
								await options.onRefresh();
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
}
