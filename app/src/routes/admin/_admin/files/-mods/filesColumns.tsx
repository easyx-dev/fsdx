/**
 * 文件管理表格列定义
 */
import {
	DownloadOutlined,
	EditOutlined,
	EyeOutlined,
	SwapOutlined,
} from "@ant-design/icons";
import { isProcessableMimeType } from "@easyx/image-toolkit";
import { formatBytes } from "@fsdx/lib/format-bytes";
import { TableOperate } from "@fsdx/ui-spa/table";
import { Button, Space, Tag, Tooltip, Typography } from "antd";
import type { FileRecord } from "#/services/file/file.server";

/** 列渲染所需的外部动作 */
export interface FilesColumnsHandlers {
	/** 打开图片预览 */
	onPreview: (record: FileRecord) => void;
	/** 打开图片编辑器 */
	onEdit: (record: FileRecord) => void;
	/** 临时文件转永久 */
	onMakePermanent: (record: FileRecord) => Promise<void>;
	/** 删除文件 */
	onDelete: (record: FileRecord) => Promise<void>;
}

/** 判断是否为图片类型（含不可编辑的 svg，仅用于是否展示预览） */
function isImage(mimeType: string): boolean {
	return mimeType.startsWith("image/");
}

export function createFilesColumns(handlers: FilesColumnsHandlers) {
	return [
		{
			title: "文件名",
			dataIndex: "originalName",
			key: "originalName",
			ellipsis: true,
			width: 200,
		},
		{
			title: "大小",
			dataIndex: "size",
			key: "size",
			width: 120,
			sorter: true,
			render: (_: unknown, record: FileRecord) => (
				<div>
					<div>{formatBytes(record.size)}</div>
					{record.width !== null && record.height !== null && (
						<Typography.Text type="secondary" style={{ fontSize: 12 }}>
							{record.width} × {record.height}
						</Typography.Text>
					)}
				</div>
			),
		},
		{
			title: "状态",
			dataIndex: "status",
			key: "status",
			width: 100,
			render: (_: unknown, record: FileRecord) => (
				<Space size={4}>
					{record.status === "permanent" ? (
						<Tag color="green">永久</Tag>
					) : (
						<>
							<Tag color="gold">临时</Tag>
							<Tooltip title="转为永久">
								<Button
									type="text"
									size="small"
									icon={<SwapOutlined style={{ color: "var(--s-success)" }} />}
									style={{ paddingInline: 4, color: "var(--s-success)" }}
									onClick={() => void handlers.onMakePermanent(record)}
								/>
							</Tooltip>
						</>
					)}
				</Space>
			),
		},
		{
			title: "上传时间",
			dataIndex: "createdAt",
			key: "createdAt",
			width: 185,
			sorter: true,
			valueType: "dateTime",
		},
		{
			title: "更新时间",
			dataIndex: "updatedAt",
			key: "updatedAt",
			width: 185,
			valueType: "dateTime",
		},
		{
			title: "操作",
			key: "actions",
			fixed: "right" as const,
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
