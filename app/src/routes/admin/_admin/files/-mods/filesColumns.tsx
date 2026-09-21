/**
 * 文件管理表格列定义
 * 时间列走 ProTable valueType；标签列以 Tag 展示图片尺寸（首位）与多标签折叠；
 * 存储与内容元信息（MIME / 存储路径 / SHA256 / 过期时间）紧随其后便于排查
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
	StatusTag,
	type StatusTagOption,
	TableOperate,
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

export function createFilesColumns(handlers: FilesColumnsHandlers) {
	return [
		{
			// 文件名不设固定宽度：与「标签」列共同分摊剩余空间
			title: "文件名",
			dataIndex: "originalName",
			key: "originalName",
			ellipsis: true,
		},
		{
			// 文件 ID 支持整串或片段检索（列表关键词同时匹配文件名与 ID）
			title: "文件 ID",
			dataIndex: "id",
			key: "id",
			width: 200,
			copyable: true,
		},
		{
			title: "大小",
			dataIndex: "size",
			key: "size",
			width: 120,
			sorter: true,
			render: (_: unknown, record: FileRecord) => formatBytes(record.size),
		},
		{
			// 标签列不设固定宽度：与「文件名」列共同分摊剩余空间
			title: "标签",
			key: "tags",
			render: (_: unknown, record: FileRecord) => renderTags(record),
		},
		{
			title: "状态",
			dataIndex: "status",
			key: "status",
			width: 130,
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
			// MIME 以服务端魔数嗅探结果为准，非客户端声明
			title: "MIME 类型",
			dataIndex: "mimeType",
			key: "mimeType",
			width: 150,
		},
		{
			// 存储相对路径（相对 STORAGE_DIR，已包含落盘文件名）
			title: "存储路径",
			dataIndex: "path",
			key: "path",
			width: 260,
			ellipsis: true,
		},
		{
			// 内容哈希：支持复制整串，省略号 Tooltip 展示完整值
			title: "SHA256",
			dataIndex: "sha256",
			key: "sha256",
			width: 200,
			ellipsis: true,
			copyable: true,
		},
		{
			// 仅临时文件有值，永久文件以占位符表示「不过期」
			title: "过期时间",
			dataIndex: "expiredAt",
			key: "expiredAt",
			width: 165,
			valueType: "dateTimeMinute",
			emptyText: "—",
		},
		{
			title: "上传时间",
			dataIndex: "createdAt",
			key: "createdAt",
			width: 165,
			sorter: true,
			valueType: "dateTimeMinute",
		},
		{
			title: "更新时间",
			dataIndex: "updatedAt",
			key: "updatedAt",
			width: 165,
			valueType: "dateTimeMinute",
		},
		{
			title: "操作",
			key: "actions",
			fixed: "right" as const,
			// 5 项（预览 / 编辑图片 / 标签 / 下载 / 删除）需 400：固定列宽度不足会把按钮挤出列外
			width: 400,
			render: (_: unknown, record: FileRecord) => (
				<TableOperate>
					{isImage(record.mimeType) && (
						<TableOperate.Custom>
							<Button
								type="link"
								size="small"
								icon={<EyeOutlined />}
								onClick={() => handlers.onPreview(record)}
							>
								预览
							</Button>
						</TableOperate.Custom>
					)}
					{isProcessableMimeType(record.mimeType) && (
						<TableOperate.Custom>
							<Button
								type="link"
								size="small"
								icon={<EditOutlined />}
								onClick={() => handlers.onEdit(record)}
							>
								编辑图片
							</Button>
						</TableOperate.Custom>
					)}
					<TableOperate.Custom>
						<Button
							type="link"
							size="small"
							icon={<TagsOutlined />}
							onClick={() => handlers.onEditTags(record)}
						>
							标签
						</Button>
					</TableOperate.Custom>
					<TableOperate.Custom>
						<a href={`/file/r/${record.id}`} target="_blank" rel="noreferrer">
							<Button type="link" size="small" icon={<DownloadOutlined />}>
								下载
							</Button>
						</a>
					</TableOperate.Custom>
					<TableOperate.Delete onConfirm={() => handlers.onDelete(record)} />
				</TableOperate>
			),
		},
	];
}
