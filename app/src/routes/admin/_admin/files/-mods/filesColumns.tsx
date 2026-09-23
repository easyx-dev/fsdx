/**
 * 文件管理表格列定义
 * 列表只保留高频列（「文件名」为主内容列，全表唯一吸收剩余宽度），
 * MIME / 存储路径 / SHA256 / 过期时间 / 更新时间等详情信息收进行展开面板，
 * 操作列把低频操作折进「更多」，使列宽合计控制在容器宽度内（不出现横向滚动）
 */
import {
	DownloadOutlined,
	EditOutlined,
	EyeOutlined,
	SwapOutlined,
	TagsOutlined,
} from "@ant-design/icons";
import { isProcessableMimeType } from "@easyx/image-toolkit";
import { formatBytes } from "@fsdx/lib/format-bytes";
import {
	actionsWidth,
	COLUMN_WIDTH,
	DetailGrid,
	formatDateTimeValue,
	StatusTag,
	type StatusTagOption,
	TableOperate,
	type TableOperateMoreItem,
} from "@fsdx/ui-spa/table";
import { Button, Space, Tag, Tooltip } from "antd";
import type { FileRecord } from "#/services/file/file.server";

/** 文件状态展示：值与语义色集中在此，避免各列自选颜色 */
const FILE_STATUS_OPTIONS: Record<string, StatusTagOption> = {
	permanent: { label: "永久", tone: "success" },
	temp: { label: "临时", tone: "warning" },
};

/** 标签列最多直接展示的数量，超出折叠为 +N */
const MAX_VISIBLE_TAGS = 2;

/** 图片尺寸 Tag 的颜色：系统推导的元信息，与用户标签的默认灰色区分 */
const IMAGE_SIZE_TAG_COLOR = "cyan";

/** 列渲染所需的外部动作 */
export interface FilesColumnsHandlers {
	/** 打开图片预览 */
	onPreview: (record: FileRecord) => void;
	/** 打开图片编辑器 */
	onEdit: (record: FileRecord) => void;
	/** 打开标签编辑弹窗 */
	onEditTags: (record: FileRecord) => void;
	/** 临时文件转永久 */
	onMakePermanent: (record: FileRecord) => Promise<void>;
	/** 删除文件 */
	onDelete: (record: FileRecord) => Promise<void>;
}

/** 判断是否为图片类型（含不可编辑的 svg，仅用于是否展示预览） */
function isImage(mimeType: string): boolean {
	return mimeType.startsWith("image/");
}

/**
 * 标签列：图片尺寸以首个 Tag 展示（自适应推导的元信息，用区别于用户标签的青色），
 * 其后为用户标签（超出折叠为 +N 并在 Tooltip 列出全部）；两项皆无时渲染占位符
 */
function renderTags(record: FileRecord) {
	const tags = record.tags ?? [];
	const hasDimensions = record.width !== null && record.height !== null;
	if (tags.length === 0 && !hasDimensions) return "—";

	const visible = tags.slice(0, MAX_VISIBLE_TAGS);
	const rest = tags.slice(MAX_VISIBLE_TAGS);
	return (
		<Space size={[4, 4]} wrap>
			{hasDimensions && (
				<Tag color={IMAGE_SIZE_TAG_COLOR} style={{ marginInlineEnd: 0 }}>
					{record.width} × {record.height}
				</Tag>
			)}
			{visible.map((tag) => (
				<Tag key={tag} style={{ marginInlineEnd: 0 }}>
					{tag}
				</Tag>
			))}
			{rest.length > 0 && (
				<Tooltip title={rest.join("、")}>
					<Tag style={{ marginInlineEnd: 0 }}>+{rest.length}</Tag>
				</Tooltip>
			)}
		</Space>
	);
}

/**
 * 行展开面板：列表放不下的内容元信息（MIME / 路径 / 哈希 / 时间）
 * 时间值复用 ProTable 的格式化实现，避免此处再手写 dayjs
 */
export function renderFileDetailPanel(record: FileRecord) {
	return (
		<DetailGrid
			items={[
				{
					key: "mimeType",
					label: "MIME 类型",
					fieldKey: "mimeType",
					value: record.mimeType,
				},
				{
					key: "path",
					label: "存储路径",
					fieldKey: "path",
					value: record.path,
				},
				{
					key: "sha256",
					label: "SHA256",
					fieldKey: "sha256",
					value: record.sha256,
				},
				{
					key: "expiredAt",
					label: "过期时间",
					fieldKey: "expiredAt",
					value: formatDateTimeValue(record.expiredAt),
				},
				{
					key: "updatedAt",
					label: "更新时间",
					fieldKey: "updatedAt",
					value: formatDateTimeValue(record.updatedAt),
				},
			]}
		/>
	);
}

/** 操作列的「更多」项：低频操作（标签编辑与图片类专属操作） */
function buildMoreItems(
	record: FileRecord,
	handlers: FilesColumnsHandlers,
): TableOperateMoreItem[] {
	const items: TableOperateMoreItem[] = [
		{
			key: "tags",
			label: "标签",
			icon: <TagsOutlined />,
			onClick: () => handlers.onEditTags(record),
		},
	];
	if (isImage(record.mimeType)) {
		items.push({
			key: "preview",
			label: "预览",
			icon: <EyeOutlined />,
			onClick: () => handlers.onPreview(record),
		});
	}
	if (isProcessableMimeType(record.mimeType)) {
		items.push({
			key: "editImage",
			label: "编辑图片",
			icon: <EditOutlined />,
			onClick: () => handlers.onEdit(record),
		});
	}
	return items;
}

/** 列渲染所需的筛选态（受控回填列头漏斗选中项） */
export interface FilesColumnsOptions {
	/** 状态列头筛选值（空串表示全部） */
	statusFilter: "" | "temp" | "permanent";
}

export function createFilesColumns(
	handlers: FilesColumnsHandlers,
	options: FilesColumnsOptions,
) {
	return [
		{
			title: "文件名",
			dataIndex: "originalName",
			key: "originalName",
			// 文件名长度不可控：取长文本档位，超长省略 + Tooltip；余宽归操作列
			width: COLUMN_WIDTH.text,
			ellipsis: true,
		},
		{
			// 文件 ID 支持整串或片段检索（列表关键词同时匹配文件名与 ID）
			title: "文件 ID",
			dataIndex: "id",
			key: "id",
			width: 150,
			copyable: true,
		},
		{
			title: "大小",
			dataIndex: "size",
			key: "size",
			width: 100,
			sorter: true,
			render: (_: unknown, record: FileRecord) => formatBytes(record.size),
		},
		{
			title: "标签",
			key: "tags",
			width: COLUMN_WIDTH.tag,
			render: (_: unknown, record: FileRecord) => renderTags(record),
		},
		{
			title: "状态",
			dataIndex: "status",
			key: "status",
			width: 100,
			// 三态状态筛选收进列头漏斗（单选），不再占用页头一行
			filters: [
				{ text: "永久", value: "permanent" },
				{ text: "临时", value: "temp" },
			],
			filterMultiple: false,
			filteredValue: options.statusFilter ? [options.statusFilter] : null,
			render: (_: unknown, record: FileRecord) => (
				<Space size={4}>
					<StatusTag value={record.status} options={FILE_STATUS_OPTIONS} />
					{record.status !== "permanent" && (
						<Tooltip title="转为永久">
							<Button
								type="text"
								size="small"
								icon={<SwapOutlined />}
								style={{ paddingInline: 4 }}
								onClick={() => void handlers.onMakePermanent(record)}
							/>
						</Tooltip>
					)}
				</Space>
			),
		},
		{
			title: "上传时间",
			dataIndex: "createdAt",
			key: "createdAt",
			width: COLUMN_WIDTH.time,
			sorter: true,
			valueType: "dateTimeMinute",
		},
		{
			title: "操作",
			key: "actions",
			fixed: "right" as const,
			// 3 项（下载 / 删除 / 更多）：低频的标签编辑与图片类操作收进「更多」
			// 弹性列：余宽归它，宽度为出现横向滚动时的按钮所需宽
			width: actionsWidth("下载", "删除", "更多"),
			elastic: true,
			render: (_: unknown, record: FileRecord) => {
				const moreItems = buildMoreItems(record, handlers);
				return (
					<TableOperate>
						<TableOperate.Custom>
							<a href={`/file/r/${record.id}`} target="_blank" rel="noreferrer">
								<Button type="link" size="small" icon={<DownloadOutlined />}>
									下载
								</Button>
							</a>
						</TableOperate.Custom>
						<TableOperate.Delete onConfirm={() => handlers.onDelete(record)} />
						{moreItems.length > 0 && <TableOperate.More items={moreItems} />}
					</TableOperate>
				);
			},
		},
	];
}
