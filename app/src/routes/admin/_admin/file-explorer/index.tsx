/**
 * 资源管理器页面：浏览和管理 STORAGE_DIR 下的文件系统
 */
import {
	CloudUploadOutlined,
	FileOutlined,
	FolderAddOutlined,
	FolderOutlined,
	ReloadOutlined,
} from "@ant-design/icons";
import { AdminPageContent } from "@fsdx/ui-spa/admin-page-content";
import { ProTable } from "@fsdx/ui-spa/pro-table";
import { safeSfnCall } from "@fsdx/ui-spa/sfn-helpers";
import { TableOperate } from "@fsdx/ui-spa/table-operate";
import { createFileRoute } from "@tanstack/react-router";
import type { UploadProps } from "antd";
import {
	Breadcrumb,
	Button,
	Input,
	Modal,
	Space,
	Tooltip,
	Typography,
	Upload,
} from "antd";
import type { ChangeEvent } from "react";
import { useCallback, useState } from "react";
import { message } from "#/components/antd-static";
import {
	createDirectorySFn,
	deleteEntrySFn,
	getTextContentSFn,
	listDirectorySFn,
	renameEntrySFn,
	uploadFileSFn,
} from "#/services/file-explorer/file-explorer.functions";
import type {
	FsEntry,
	ListDirectoryResult,
} from "#/services/file-explorer/file-explorer.server";

/** 面包屑项类型 */
interface BreadcrumbItem {
	label: string;
	path: string;
}

/** 目录数据（含面包屑和写保护状态） */
interface DirData extends ListDirectoryResult {
	breadcrumb: BreadcrumbItem[];
	writeProtected: boolean;
}

/** 文本文件扩展名列表 */
const TEXT_EXTENSIONS = new Set([
	"txt",
	"md",
	"json",
	"xml",
	"yaml",
	"yml",
	"log",
	"csv",
	"js",
	"ts",
	"tsx",
	"jsx",
	"css",
	"html",
	"htm",
	"sh",
	"bash",
	"zsh",
	"py",
	"rb",
	"go",
	"rs",
	"java",
	"c",
	"cpp",
	"h",
	"hpp",
	"ini",
	"toml",
	"cfg",
	"conf",
	"env",
	"gitignore",
	"sql",
	"graphql",
	"vue",
	"svelte",
	"less",
	"scss",
	"sass",
]);

/** 格式化文件大小 */
function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024)
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** 判断是否为文本文件 */
function isTextFile(name: string): boolean {
	const ext = name.split(".").pop()?.toLowerCase() ?? "";
	return TEXT_EXTENSIONS.has(ext);
}

/** 构建条目的子路径 */
function entryPath(parentPath: string, name: string): string {
	return parentPath ? `${parentPath}/${name}` : name;
}

export const Route = createFileRoute("/admin/_admin/file-explorer/")({
	component: FileExplorerPage,
	loader: async () => {
		return listDirectorySFn({ data: { subPath: "" } });
	},
});

function FileExplorerPage() {
	const initialData = Route.useLoaderData() as DirData;
	const [data, setData] = useState<DirData>(initialData);
	const [currentPath, setCurrentPath] = useState("");
	const [loading, setLoading] = useState(false);

	// Modal 状态
	const [mkdirOpen, setMkdirOpen] = useState(false);
	const [mkdirName, setMkdirName] = useState("");
	const [mkdirLoading, setMkdirLoading] = useState(false);

	const [renameOpen, setRenameOpen] = useState(false);
	const [renameTarget, setRenameTarget] = useState<FsEntry | null>(null);
	const [renameNewName, setRenameNewName] = useState("");
	const [renameLoading, setRenameLoading] = useState(false);

	const [previewOpen, setPreviewOpen] = useState(false);
	const [previewTitle, setPreviewTitle] = useState("");
	const [previewContent, setPreviewContent] = useState("");
	const [previewLoading, setPreviewLoading] = useState(false);

	const [uploading, setUploading] = useState(false);

	/** 刷新当前目录 */
	const refreshDir = useCallback(
		async (subPath?: string) => {
			const path = subPath ?? currentPath;
			setLoading(true);
			try {
				const result = await safeSfnCall(
					listDirectorySFn({ data: { subPath: path } }),
				);
				setData(result as DirData);
				setCurrentPath(path);
			} catch {
				// safeSfnCall 已处理
			} finally {
				setLoading(false);
			}
		},
		[currentPath],
	);

	/** 导航到指定目录 */
	const navigateTo = useCallback(
		(subPath: string) => {
			refreshDir(subPath);
		},
		[refreshDir],
	);

	/** 面包屑点击 */
	const handleBreadcrumbClick = useCallback(
		(path: string) => {
			navigateTo(path);
		},
		[navigateTo],
	);

	/** 创建目录 */
	const handleMkdir = useCallback(async () => {
		if (!mkdirName.trim()) return;
		setMkdirLoading(true);
		try {
			await safeSfnCall(
				createDirectorySFn({
					data: { subPath: currentPath, name: mkdirName.trim() },
				}),
				"创建目录失败",
			);
			message.success("目录创建成功");
			setMkdirOpen(false);
			setMkdirName("");
			await refreshDir();
		} catch {
			// safeSfnCall 已处理
		} finally {
			setMkdirLoading(false);
		}
	}, [mkdirName, currentPath, refreshDir]);

	/** 删除条目 */
	const handleDelete = useCallback(
		async (entry: FsEntry) => {
			const targetPath = entryPath(currentPath, entry.name);
			try {
				await safeSfnCall(
					deleteEntrySFn({ data: { subPath: targetPath } }),
					"删除失败",
				);
				message.success(`已删除：${entry.name}`);
				await refreshDir();
			} catch {
				// safeSfnCall 已处理
			}
		},
		[currentPath, refreshDir],
	);

	/** 重命名条目 */
	const handleRename = useCallback(async () => {
		if (!renameNewName.trim() || !renameTarget) return;
		setRenameLoading(true);
		try {
			const targetPath = entryPath(currentPath, renameTarget.name);
			await safeSfnCall(
				renameEntrySFn({
					data: { subPath: targetPath, newName: renameNewName.trim() },
				}),
				"重命名失败",
			);
			message.success(`已重命名为：${renameNewName.trim()}`);
			setRenameOpen(false);
			setRenameTarget(null);
			setRenameNewName("");
			await refreshDir();
		} catch {
			// safeSfnCall 已处理
		} finally {
			setRenameLoading(false);
		}
	}, [renameNewName, renameTarget, currentPath, refreshDir]);

	/** 预览文本文件 */
	const handlePreview = useCallback(
		async (entry: FsEntry) => {
			setPreviewLoading(true);
			setPreviewOpen(true);
			setPreviewTitle(entry.name);
			setPreviewContent("");
			try {
				const targetPath = entryPath(currentPath, entry.name);
				const content = await safeSfnCall(
					getTextContentSFn({ data: { subPath: targetPath } }),
					"读取文件内容失败",
				);
				setPreviewContent(content);
			} catch {
				setPreviewOpen(false);
			} finally {
				setPreviewLoading(false);
			}
		},
		[currentPath],
	);

	/** 文件上传 */
	const customUploadRequest: UploadProps["customRequest"] = useCallback(
		async (options) => {
			const { file, onSuccess, onError } = options;
			setUploading(true);
			try {
				const fd = new FormData();
				fd.append("file", file as File);
				fd.append("subPath", currentPath);
				await uploadFileSFn({ data: fd });
				message.success(`上传成功：${(file as File).name}`);
				onSuccess?.("ok");
				await refreshDir();
			} catch (err) {
				const msg = err instanceof Error ? err.message : "上传失败";
				message.error(msg);
				onError?.(err as Error);
			} finally {
				setUploading(false);
			}
		},
		[currentPath, refreshDir],
	);

	/** 表格列定义 */
	const columns = [
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
							? () => navigateTo(entryPath(currentPath, record.name))
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
				const isWriteLocked = data.writeProtected;

				return (
					<TableOperate>
						{record.type === "file" && isTextFile(record.name) && (
							<TableOperate.Custom>
								<Button
									type="link"
									size="small"
									onClick={() => handlePreview(record)}
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
											`/api/download/file-explorer/${encodeURIComponent(entryPath(currentPath, record.name))}`,
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
									onClick={() => {
										setRenameTarget(record);
										setRenameNewName(record.name);
										setRenameOpen(true);
									}}
								>
									重命名
								</Button>
							</TableOperate.Custom>
						)}
						{!isWriteLocked && (
							<TableOperate.Delete
								recordName={record.name}
								onConfirm={async () => {
									await handleDelete(record);
								}}
							/>
						)}
					</TableOperate>
				);
			},
		},
	];

	/** 工具栏 */
	const dirCount = data.entries.filter((e) => e.type === "directory").length;
	const fileCount = data.entries.filter((e) => e.type === "file").length;

	const toolbar = (
		<Space size={12}>
			<span style={{ color: "#8c8c8c", fontSize: 13 }}>
				{data.entries.length > 0 && (
					<>
						{dirCount > 0 && `${dirCount} 个目录`}
						{dirCount > 0 && fileCount > 0 && "，"}
						{fileCount > 0 && `${fileCount} 个文件`}
					</>
				)}
			</span>
			<Upload
				customRequest={customUploadRequest}
				showUploadList={false}
				disabled={uploading || data.writeProtected}
			>
				<Tooltip
					title={data.writeProtected ? "当前目录写保护，禁止上传" : undefined}
				>
					<Button
						type="primary"
						icon={<CloudUploadOutlined />}
						disabled={data.writeProtected}
					>
						上传文件
					</Button>
				</Tooltip>
			</Upload>
			<Button
				icon={<FolderAddOutlined />}
				disabled={data.writeProtected}
				onClick={() => {
					setMkdirName("");
					setMkdirOpen(true);
				}}
			>
				新建目录
			</Button>
			<Button
				icon={<ReloadOutlined />}
				loading={loading}
				onClick={() => refreshDir()}
			>
				刷新
			</Button>
		</Space>
	);

	return (
		<AdminPageContent
			title={
				<Space>
					<span style={{ fontSize: 16, fontWeight: 600 }}>资源管理器</span>
					<Breadcrumb
						items={data.breadcrumb?.map((item, index) => {
							const isLast = index === data.breadcrumb.length - 1;
							return {
								title: isLast ? (
									<span
										style={{ fontSize: 13, fontWeight: 500, color: "#1a1a2e" }}
									>
										{item.label}
									</span>
								) : (
									<Button
										type="link"
										size="small"
										style={{ padding: 0, fontSize: 13 }}
										onClick={() => handleBreadcrumbClick(item.path)}
									>
										{item.label}
									</Button>
								),
							};
						})}
						style={{ fontSize: 13 }}
					/>
				</Space>
			}
			extra={toolbar}
		>
			<ProTable
				dataSource={data.entries}
				columns={columns}
				rowKey="name"
				loading={loading}
				locale={{ emptyText: "目录为空" }}
				scroll={{ x: 610 }}
				pagination={false}
				bordered
			/>

			{/* 新建目录 Modal */}
			<Modal
				open={mkdirOpen}
				title="新建目录"
				okText="创建"
				cancelText="取消"
				confirmLoading={mkdirLoading}
				onOk={handleMkdir}
				onCancel={() => {
					setMkdirOpen(false);
					setMkdirName("");
				}}
				destroyOnClose
				styles={{ body: { paddingBottom: 8 } }}
			>
				<Input
					placeholder="请输入目录名称"
					value={mkdirName}
					onChange={(e: ChangeEvent<HTMLInputElement>) =>
						setMkdirName(e.target.value)
					}
					onPressEnter={handleMkdir}
				/>
			</Modal>

			{/* 重命名 Modal */}
			<Modal
				open={renameOpen}
				title="重命名"
				okText="确认"
				cancelText="取消"
				confirmLoading={renameLoading}
				onOk={handleRename}
				onCancel={() => {
					setRenameOpen(false);
					setRenameTarget(null);
					setRenameNewName("");
				}}
				destroyOnClose
				styles={{ body: { paddingBottom: 8 } }}
			>
				<Input
					placeholder="请输入新名称"
					value={renameNewName}
					onChange={(e: ChangeEvent<HTMLInputElement>) =>
						setRenameNewName(e.target.value)
					}
					onPressEnter={handleRename}
				/>
			</Modal>

			{/* 文本预览 Modal */}
			<Modal
				open={previewOpen}
				title={previewTitle}
				footer={null}
				width="75%"
				onCancel={() => {
					setPreviewOpen(false);
					setPreviewContent("");
				}}
				destroyOnClose
				styles={{ body: { padding: 0 } }}
			>
				{previewLoading ? (
					<div style={{ textAlign: "center", padding: 60, color: "#8c8c8c" }}>
						加载中...
					</div>
				) : (
					<pre
						style={{
							maxHeight: "72vh",
							overflow: "auto",
							background: "#1e1e1e",
							color: "#d4d4d4",
							padding: 20,
							fontSize: 13,
							lineHeight: 1.7,
							margin: 0,
							borderRadius: "0 0 0 0",
							whiteSpace: "pre-wrap",
							wordBreak: "break-all",
							fontFamily: "'SF Mono', 'Cascadia Code', 'Consolas', monospace",
						}}
					>
						{previewContent}
					</pre>
				)}
			</Modal>
		</AdminPageContent>
	);
}
