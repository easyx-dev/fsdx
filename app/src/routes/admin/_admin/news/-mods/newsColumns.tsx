/**
 * 新闻管理表格列定义
 * 封面列放最前；发布状态与排序权重为通用态（单元格内联编辑）；时间列走 ProTable valueType
 */
import {
	ImageCell,
	PublishSwitchCell,
	SortOrderCell,
	StatusTag,
	type StatusTagOption,
	TableOperate,
} from "@fsdx/ui-spa/table";
import { Space, Tag } from "antd";
import { FieldTranslationDrawer } from "#/components/admin";
import type { NewsRecord } from "#/services/news/news.server";

/** 新闻可翻译字段定义 */
const NEWS_TRANSLATABLE_FIELDS = [
	{ name: "title", label: "新闻标题", valueType: "input" as const },
	{ name: "description", label: "新闻摘要", valueType: "text" as const },
	{ name: "content", label: "新闻内容", valueType: "rich" as const },
];

/** 内容类型：外部链接 / 内部文章 */
const NEWS_TYPE_OPTIONS: Record<string, StatusTagOption> = {
	external: { label: "外部链接", tone: "info" },
	internal: { label: "内部文章", tone: "success" },
};

interface NewsColumnsOptions {
	/** 列排序属性生成器（来自 useListQuery.sortProps） */
	sortProps: (field: string) => {
		sorter: true;
		sortOrder?: "ascend" | "descend";
	};
	/** 打开编辑抽屉 */
	onEdit: (record: NewsRecord) => void;
	/** 单元格内切换发布状态 */
	onTogglePublished: (record: NewsRecord, next: boolean) => Promise<void>;
	/** 单元格内修改排序权重 */
	onChangeSortOrder: (record: NewsRecord, next: number) => Promise<void>;
	/** 删除 */
	onDelete: (record: NewsRecord) => Promise<void>;
	/** 权限开关：无权限的操作置灰并提示（服务端 guard 仍为唯一权威） */
	permissions: {
		edit: boolean;
		publish: boolean;
		delete: boolean;
	};
	/** 发布状态列头筛选值（空串表示全部），受控回填漏斗选中态 */
	publishedFilter: string;
}

const NO_EDIT_PERMISSION = "无「编辑新闻」权限";
const NO_PUBLISH_PERMISSION = "无「新闻上下架」权限";
const NO_DELETE_PERMISSION = "无「删除新闻」权限";

/** 发布状态列头漏斗选项（单选，对应 isPublished） */
const PUBLISHED_FILTER_OPTIONS = [
	{ text: "已发布", value: "published" },
	{ text: "未发布", value: "unpublished" },
];

export function newsColumns(options: NewsColumnsOptions) {
	const { permissions } = options;
	return [
		{
			// 图片列放最前（无序号 / ID / 展开 / 选择列），固定正方形等比缩放
			title: "封面",
			key: "cover",
			width: 80,
			render: (_: unknown, record: NewsRecord) => (
				<ImageCell
					src={record.coverImageId ? `/file/r/${record.coverImageId}` : null}
				/>
			),
		},
		{
			// 主内容列：全表唯一吸收剩余宽度的列，其余列一律定宽（列宽可预测、不随内容漂移）
			title: "标题",
			dataIndex: "title",
			key: "title",
			ellipsis: true,
		},
		{
			// 发布状态：单元格内开关直接切换（乐观更新 + 失败回滚）
			// 三态筛选收进列头漏斗（单选），不再占用页头一行
			title: "状态",
			dataIndex: "isPublished",
			key: "isPublished",
			width: 100,
			filters: PUBLISHED_FILTER_OPTIONS,
			filterMultiple: false,
			filteredValue: options.publishedFilter ? [options.publishedFilter] : null,
			render: (_: unknown, record: NewsRecord) => (
				<PublishSwitchCell
					published={record.isPublished}
					labels={{ on: "已发布", off: "未发布" }}
					onToggle={(next) => options.onTogglePublished(record, next)}
					disabled={!permissions.publish}
					disabledReason={NO_PUBLISH_PERMISSION}
				/>
			),
		},
		{
			title: "标记",
			key: "flags",
			width: 100,
			render: (_: unknown, record: NewsRecord) =>
				record.isPinned || record.isRecommended ? (
					<Space size={4}>
						{record.isPinned && <Tag color="blue">置顶</Tag>}
						{record.isRecommended && <Tag color="gold">推荐</Tag>}
					</Space>
				) : (
					"—"
				),
		},
		{
			// 排序权重：单元格内失焦 / 回车提交；表头排序用于按该列排序
			title: "排序",
			dataIndex: "sortOrder",
			key: "sortOrder",
			width: 115,
			...options.sortProps("sortOrder"),
			render: (_: unknown, record: NewsRecord) => (
				<SortOrderCell
					value={record.sortOrder}
					onSubmit={(next) => options.onChangeSortOrder(record, next)}
					disabled={!permissions.edit}
					disabledReason={NO_EDIT_PERMISSION}
				/>
			),
		},
		{
			title: "类型",
			key: "type",
			width: 110,
			render: (_: unknown, record: NewsRecord) => (
				<StatusTag
					value={record.externalUrl ? "external" : "internal"}
					options={NEWS_TYPE_OPTIONS}
				/>
			),
		},
		{
			title: "发布时间",
			dataIndex: "publishedAt",
			key: "publishedAt",
			width: 165,
			...options.sortProps("publishedAt"),
			valueType: "dateTimeMinute",
			emptyText: "—",
		},
		{
			title: "操作",
			key: "actions",
			fixed: "right" as const,
			// 操作列固定右侧必须显式声明宽度（宽度不足会被挤压导致按钮溢出）
			width: 240,
			render: (_: unknown, record: NewsRecord) => (
				<TableOperate>
					<TableOperate.Edit
						onClick={() => options.onEdit(record)}
						disabled={!permissions.edit}
						disabledReason={NO_EDIT_PERMISSION}
					/>
					<TableOperate.Delete
						recordName="这条新闻"
						disabled={!permissions.delete}
						disabledReason={NO_DELETE_PERMISSION}
						onConfirm={() => options.onDelete(record)}
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
