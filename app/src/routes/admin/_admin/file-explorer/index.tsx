/**
 * 资源管理器页面：浏览和管理 STORAGE_DIR 下的文件系统
 */
import {
	CloudUploadOutlined,
	FolderAddOutlined,
	ReloadOutlined,
} from "@ant-design/icons";
import { message } from "@fsdx/ui-spa/antd-static";
import { safeSfnCall } from "@fsdx/ui-spa/sfn-helpers";
import { ProTable } from "@fsdx/ui-spa/table";
import { createFileRoute } from "@tanstack/react-router";
import type { UploadProps } from "antd";
import { Breadcrumb, Button, Space, Tooltip, Upload } from "antd";
import { useCallback, useState } from "react";
import { AdminPageContent } from "#/components/admin";
import {
	createDirectorySFn,
	deleteEntrySFn,
	getTextContentSFn,
	listDirectorySFn,
	renameEntrySFn,
	uploadFileSFn,
} from "#/services/file-explorer/file-explorer.functions";
import type { FsEntry } from "#/services/file-explorer/file-explorer.server";
import { MkdirModal, PreviewModal, RenameModal } from "./-mods/FileModals";
import { fileExplorerColumns } from "./-mods/fileExplorerColumns";
import { type DirData, entryPath } from "./-mods/fileExplorerUtils";

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

	const columns = fileExplorerColumns({
		currentPath,
		writeProtected: data.writeProtected,
		onNavigate: navigateTo,
		onPreview: handlePreview,
		onRename: (record) => {
			setRenameTarget(record);
			setRenameNewName(record.name);
			setRenameOpen(true);
		},
		onDelete: handleDelete,
	});

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

			<MkdirModal
				open={mkdirOpen}
				value={mkdirName}
				loading={mkdirLoading}
				onChange={setMkdirName}
				onOk={handleMkdir}
				onCancel={() => {
					setMkdirOpen(false);
					setMkdirName("");
				}}
			/>

			<RenameModal
				open={renameOpen}
				value={renameNewName}
				loading={renameLoading}
				onChange={setRenameNewName}
				onOk={handleRename}
				onCancel={() => {
					setRenameOpen(false);
					setRenameTarget(null);
					setRenameNewName("");
				}}
			/>

			<PreviewModal
				open={previewOpen}
				title={previewTitle}
				content={previewContent}
				loading={previewLoading}
				onCancel={() => {
					setPreviewOpen(false);
					setPreviewContent("");
				}}
			/>
		</AdminPageContent>
	);
}
