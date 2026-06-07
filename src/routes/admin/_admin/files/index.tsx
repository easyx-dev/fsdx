/**
 * 文件管理页面：上传、列表、下载、删除、秒传
 */
import {
	CheckOutlined,
	DeleteOutlined,
	UploadOutlined,
} from "@ant-design/icons";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { UploadProps } from "antd";
import {
	Button,
	message,
	Popconfirm,
	Segmented,
	Space,
	Table,
	Tag,
	Upload,
} from "antd";
import { useState } from "react";
import { z } from "zod";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { permGuard } from "#/middleware/server-fn-auth";
import { uploadFile } from "#/server/file/file.functions";
import type { FileRecord } from "#/server/file/file.server";
import {
	deleteFile,
	getFileList as getFileListService,
	makePermanent,
} from "#/server/file/file.server";

const fileListSchema = z.object({ status: z.string().optional() });
const idSchema = z.object({ id: z.string().min(1) });

const getFileList = createServerFn({ method: "GET" })
	.middleware([permGuard(PERMISSIONS.FILE_VIEW)])
	.inputValidator(fileListSchema)
	.handler(async ({ data }) => {
		return getFileListService(data.status);
	});

const deleteFileFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.FILE_DELETE)])
	.inputValidator(idSchema)
	.handler(async ({ data }) => {
		await deleteFile(data.id);
		return { success: true };
	});

const makePermanentFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.FILE_EDIT)])
	.inputValidator(idSchema)
	.handler(async ({ data }) => {
		await makePermanent(data.id);
		return { success: true };
	});

/** 格式化文件大小 */
function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 格式化日期 */
function formatDate(d: Date | string | null): string {
	if (!d) return "—";
	return new Date(d).toLocaleString("zh-CN");
}

export const Route = createFileRoute("/admin/_admin/files/")({
	component: FilesPage,
	loader: async () => await getFileList({ data: {} }),
});

function FilesPage() {
	const router = useRouter();
	const initialFiles = Route.useLoaderData();
	const [files, setFiles] = useState(initialFiles);
	const [filter, setFilter] = useState("");
	const [uploading, setUploading] = useState(false);

	/** 按当前筛选项刷新文件列表 */
	const refreshFiles = async () => {
		const data = await getFileList({ data: { status: filter || undefined } });
		setFiles(data);
	};

	/** 切换筛选状态并刷新列表 */
	const handleFilterChange = async (status: string) => {
		setFilter(status);
		const data = await getFileList({
			data: { status: status || undefined },
		});
		setFiles(data);
	};

	/** antd Upload 自定义上传逻辑：构造 FormData 调用服务端上传接口 */
	const customRequest: UploadProps["customRequest"] = async (options) => {
		const { file, onSuccess, onError } = options;
		setUploading(true);
		try {
			const fd = new FormData();
			fd.append("file", file as File);
			const result = await uploadFile({ data: fd });
			if (result.success) {
				onSuccess?.(result.data);
				message.success(
					result.data.isDuplicated ? "秒传成功（文件已存在）" : "上传成功",
				);
				await refreshFiles();
				await router.invalidate();
			} else {
				onError?.(new Error("上传失败"));
				message.error("上传失败");
			}
		} catch (err) {
			console.error("[文件上传失败]", err);
			onError?.(err as Error);
			message.error("上传失败: 网络错误");
		} finally {
			setUploading(false);
		}
	};

	const columns = [
		{
			title: "文件名",
			dataIndex: "originalName",
			key: "originalName",
			ellipsis: true,
		},
		{
			title: "大小",
			dataIndex: "size",
			key: "size",
			width: 100,
			render: (_: unknown, record: FileRecord) => formatSize(record.size),
		},
		{
			title: "状态",
			dataIndex: "status",
			key: "status",
			width: 100,
			render: (_: unknown, record: FileRecord) =>
				record.status === "permanent" ? (
					<Tag color="green">永久</Tag>
				) : (
					<Tag color="gold">临时</Tag>
				),
		},
		{
			title: "上传时间",
			dataIndex: "createdAt",
			key: "createdAt",
			width: 180,
			render: (_: unknown, record: FileRecord) => formatDate(record.createdAt),
		},
		{
			title: "操作",
			key: "actions",
			width: 160,
			render: (_: unknown, record: FileRecord) => (
				<Space size={4}>
					{record.status === "temp" && (
						<Button
							type="link"
							size="small"
							icon={<CheckOutlined />}
							onClick={async () => {
								await makePermanentFn({ data: { id: record.id } });
								message.success("已转为永久");
								await refreshFiles();
							}}
						>
							转为永久
						</Button>
					)}
					<Popconfirm
						title="确定删除？"
						onConfirm={async () => {
							await deleteFileFn({ data: { id: record.id } });
							message.success("已删除");
							await refreshFiles();
						}}
					>
						<Button type="link" size="small" danger icon={<DeleteOutlined />} />
					</Popconfirm>
				</Space>
			),
		},
	];

	return (
		<AdminPageContent
			title="文件管理"
			extra={
				<Upload
					customRequest={customRequest}
					showUploadList={false}
					disabled={uploading}
				>
					<Button type="primary" icon={<UploadOutlined />} loading={uploading}>
						{uploading ? "上传中..." : "上传文件"}
					</Button>
				</Upload>
			}
		>
			<div className="mb-4">
				<Segmented
					options={[
						{ label: "全部", value: "" },
						{ label: "临时", value: "temp" },
						{ label: "永久", value: "permanent" },
					]}
					value={filter}
					onChange={(value) => {
						handleFilterChange(value as string);
					}}
				/>
			</div>

			<Table
				dataSource={files}
				columns={columns}
				rowKey="id"
				locale={{ emptyText: "暂无文件" }}
			/>
		</AdminPageContent>
	);
}
