/**
 * 资源管理器表格列定义
 */
import { FileOutlined, FolderOutlined } from "@ant-design/icons";
import { TableOperate } from "@fsdx/ui-spa/table";
import { Button, Typography } from "antd";
import type { FsEntry } from "#/services/file-explorer/file-explorer.server";
import { entryPath, formatSize, isTextFile } from "./fileExplorerUtils";

interface FileExplorerColumnsOptions {
	currentPath: string;
	writeProtected: boolean;
	onNavigate: (path: string) => void;
	onPreview: (record: FsEntry) => void;
	onRename: (record: FsEntry) => void;
	onDelete: (record: FsEntry) => void;
}

/** 资源管理器表格列：目录可点击进入，写保护时禁用重命名/删除 */
export function fileExplorerColumns(options: FileExplorerColumnsOptions) {
	return [
		{
			title: "名称",
			dataIndex: "name",
			key: "name",
			render: (_: unknown, record: FsEntry) => (
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: 10,
						cursor: record.type === "directory" ? "pointer" : "default",
						padding: "2px 0",
					}}
					onClick={
						record.type === "directory"
							? () =>
									options.onNavigate(
										entryPath(options.currentPath, record.name),
									)
							: undefined
					}
				>
					{record.type === "directory" ? (
						<FolderOutlined
							style={{ color: "#faad14", fontSize: 18, flexShrink: 0 }}
						/>
					) : (
						<FileOutlined
							style={{ color: "var(--s-primary)", fontSize: 16, flexShrink: 0 }}
						/>
					)}
					<Typography.Text
						ellipsis={{ tooltip: record.name }}
						style={{
							color: record.type === "directory" ? "#1a1a2e" : "#4a4a4a",
							fontWeight: record.type === "directory" ? 500 : 400,
						}}
					>
						{record.name}
					</Typography.Text>
				</div>
			),
		},
		{
			title: "大小",
			dataIndex: "size",
			key: "size",
			width: 150,
			align: "right" as const,
			sorter: (a: FsEntry, b: FsEntry) => a.size - b.size,
			render: (_: unknown, record: FsEntry) => (
				<span style={{ color: "#8c8c8c", fontSize: 13 }}>
					{record.type === "directory" ? "-" : formatSize(record.size)}
				</span>
			),
		},
		{
			title: "修改时间",
			dataIndex: "mtime",
			key: "mtime",
			width: 180,
			sorter: (a: FsEntry, b: FsEntry) =>
				new Date(a.mtime).getTime() - new Date(b.mtime).getTime(),
			valueType: "dateTime",
		},
		{
			title: "操作",
			key: "actions",
			width: 240,
			fixed: "right" as const,
			render: (_: unknown, record: FsEntry) => {
				const isWriteLocked = options.writeProtected;

				return (
					<TableOperate>
						{record.type === "file" && isTextFile(record.name) && (
							<TableOperate.Custom>
								<Button
									type="link"
									size="small"
									onClick={() => options.onPreview(record)}
								>
									预览
								</Button>
							</TableOperate.Custom>
						)}
						{record.type === "file" && (
							<TableOperate.Custom>
								<Button
									type="link"
									size="small"
									onClick={() => {
										window.open(
											`/admin/file-explorer/download/${encodeURIComponent(entryPath(options.currentPath, record.name))}`,
											"_blank",
											"noreferrer",
										);
									}}
								>
									下载
								</Button>
							</TableOperate.Custom>
						)}
						{!isWriteLocked && (
							<TableOperate.Custom>
								<Button
									type="link"
									size="small"
									onClick={() => options.onRename(record)}
								>
									重命名
								</Button>
							</TableOperate.Custom>
						)}
						{!isWriteLocked && (
							<TableOperate.Delete
								recordName={record.name}
								onConfirm={async () => {
									await options.onDelete(record);
								}}
							/>
						)}
					</TableOperate>
				);
			},
		},
	];
}
