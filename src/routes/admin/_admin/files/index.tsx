/**
 * 文件管理页面：上传、列表、下载、删除、秒传
 */
import {
	CheckOutlined,
	ClockCircleOutlined,
	CloudUploadOutlined,
	DeleteOutlined,
	DownloadOutlined,
	EyeOutlined,
} from "@ant-design/icons";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { UploadProps } from "antd";
import {
	Button,
	Col,
	Input,
	Modal,
	message,
	Popconfirm,
	Row,
	Segmented,
	Space,
	Tag,
	Upload,
} from "antd";
import { useState } from "react";
import { z } from "zod";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import { ProTable } from "#/components/admin/ProTable";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import { uploadFile } from "#/server/file/file.functions";
import type { FileRecord } from "#/server/file/file.server";
import {
	deleteFile,
	getFileList as getFileListService,
	makePermanent,
} from "#/server/file/file.server";

const fileListSchema = z.object({
	status: z.string().optional(),
	keyword: z.string().optional(),
	sortField: z.string().optional(),
	sortOrder: z.string().optional(),
});
const idSchema = z.object({ id: z.string().min(1) });

const getFileList = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.FILE_VIEW)])
	.inputValidator(fileListSchema)
	.handler(async ({ data }) => {
		return getFileListService(data);
	});

const deleteFileFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.FILE_DELETE)])
	.inputValidator(idSchema)
	.handler(async ({ data }) => {
		await deleteFile(data.id);
		return { success: true };
	});

const makePermanentFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.FILE_EDIT)])
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
	const [keyword, setKeyword] = useState("");
	const [sortField, setSortField] = useState<string | undefined>();
	const [sortOrder, setSortOrder] = useState<string | undefined>();
	const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);

	/** 按当前条件刷新文件列表 */
	const refreshFiles = async (params?: {
		status?: string;
		keyword?: string;
		sortField?: string;
		sortOrder?: string;
	}) => {
		const data = await getFileList({
			data: {
				status: (params?.status ?? filter) || undefined,
				keyword: (params?.keyword ?? keyword) || undefined,
				sortField: params?.sortField ?? sortField,
				sortOrder: params?.sortOrder ?? sortOrder,
			},
		});
		setFiles(data);
	};

	/** 切换筛选状态并刷新列表 */
	const handleFilterChange = async (status: string) => {
		setFilter(status);
		await refreshFiles({ status });
	};

	/** 按关键词搜索 */
	const handleSearch = async (value: string) => {
		setKeyword(value);
		await refreshFiles({ keyword: value });
	};

	/** 表格排序变更 */
	const handleTableChange = async (
		_pagination: unknown,
		_filters: unknown,
		sorter: unknown,
	) => {
		const s = sorter as { field?: string; order?: string };
		const field = s.field as string | undefined;
		const order = s.order as string | undefined;
		setSortField(field);
		setSortOrder(order);
		await refreshFiles({ sortField: field, sortOrder: order });
	};

	/** 上传核心逻辑 */
	const doUpload = async (
		file: File,
		onSuccess: (body: unknown) => void,
		onError: (err: Error) => void,
		makePermanentAfter?: boolean,
	) => {
		setUploading(true);
		try {
			const fd = new FormData();
			fd.append("file", file);
			const result = await uploadFile({ data: fd });
			if (result.success) {
				// 永久文件上传后立即转为永久
				if (makePermanentAfter && !result.data.isDuplicated) {
					await makePermanentFn({ data: { id: result.data.id } });
				}
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

	/** 临时文件上传 */
	const tempRequest: UploadProps["customRequest"] = async (options) => {
		const { file, onSuccess, onError } = options;
		await doUpload(file as File, onSuccess!, onError!);
	};

	/** 永久文件上传 */
	const permanentRequest: UploadProps["customRequest"] = async (options) => {
		const { file, onSuccess, onError } = options;
		await doUpload(file as File, onSuccess!, onError!, true);
	};

	/** 判断是否为图片类型 */
	const isImage = (mimeType: string) => mimeType.startsWith("image/");

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
			sorter: true,
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
			sorter: true,
			render: (_: unknown, record: FileRecord) => formatDate(record.createdAt),
		},
		{
			title: "操作",
			key: "actions",
			width: 200,
			render: (_: unknown, record: FileRecord) => (
				<Space size={4}>
					{isImage(record.mimeType) && (
						<Button
							type="link"
							size="small"
							icon={<EyeOutlined />}
							onClick={() => setPreviewFile(record)}
						>
							预览
						</Button>
					)}
					<a
						href={`/api/download/file/${record.id}`}
						target="_blank"
						rel="noreferrer"
					>
						<Button type="link" size="small" icon={<DownloadOutlined />}>
							下载
						</Button>
					</a>

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
		<AdminPageContent title="文件管理">
			{/* 双路上传区：永久 / 临时 */}
			<Row gutter={16} style={{ marginBottom: 16 }}>
				<Col span={12}>
					<Upload.Dragger
						customRequest={permanentRequest}
						showUploadList={true}
						disabled={uploading}
						className="compact-dragger"
					>
						<p className="ant-upload-text">
							<CloudUploadOutlined style={{ marginRight: 6 }} />
							永久文件上传
						</p>
					</Upload.Dragger>
				</Col>
				<Col span={12}>
					<Upload.Dragger
						customRequest={tempRequest}
						showUploadList={true}
						disabled={uploading}
						className="compact-dragger"
					>
						<p className="ant-upload-text">
							<ClockCircleOutlined style={{ marginRight: 6 }} />
							临时文件上传（24 小时后过期）
						</p>
					</Upload.Dragger>
				</Col>
			</Row>

			{/* 筛选 + 搜索栏 */}
			<div
				style={{
					marginBottom: 16,
					display: "flex",
					gap: 12,
					alignItems: "center",
					flexWrap: "wrap",
				}}
			>
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
				<Input.Search
					placeholder="搜索文件名..."
					allowClear
					onSearch={handleSearch}
					style={{ width: 240 }}
				/>
			</div>

			<ProTable
				dataSource={files}
				columns={columns}
				rowKey="id"
				locale={{ emptyText: "暂无文件" }}
				onChange={handleTableChange}
			/>

			{/* 图片预览 Modal */}
			<Modal
				open={!!previewFile}
				title={previewFile?.originalName}
				footer={null}
				onCancel={() => setPreviewFile(null)}
				width="auto"
				centered
			>
				{previewFile && isImage(previewFile.mimeType) && (
					<img
						src={`/api/download/file/${previewFile.id}`}
						alt={previewFile.originalName}
						style={{ maxWidth: "80vw", maxHeight: "80vh" }}
					/>
				)}
			</Modal>
		</AdminPageContent>
	);
}
