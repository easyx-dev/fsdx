/**
 * 文件管理页面：上传、列表、下载、删除、秒传
 */
import {
	ClockCircleOutlined,
	CloudUploadOutlined,
	DownloadOutlined,
	EyeOutlined,
	SwapOutlined,
} from "@ant-design/icons";
import { message } from "@fsdx/ui-spa/antd-static";
import { ProTable, TableOperate } from "@fsdx/ui-spa/table";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import type { UploadProps } from "antd";
import {
	Button,
	Col,
	Input,
	Modal,
	Row,
	Segmented,
	Space,
	Tag,
	Tooltip,
	Upload,
} from "antd";
import { useRef, useState } from "react";
import { AdminPageContent } from "#/components/admin";
import { getFileListSFn, uploadFileSFn } from "#/services/file/file.functions";
import type { FileRecord } from "#/services/file/file.server";
import { deleteFileSFn, makePermanentSFn } from "./-mods/files.functions";

/** 格式化文件大小 */
function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const Route = createFileRoute("/admin/_admin/files/")({
	component: FilesPage,
	loader: async () => await getFileListSFn({ data: {} }),
});

function FilesPage() {
	const router = useRouter();
	const initialData = Route.useLoaderData();
	const [data, setData] = useState(initialData);
	const [filter, setFilter] = useState("");
	const uploadingCountRef = useRef(0);
	const [uploading, setUploading] = useState(false);
	const [keyword, setKeyword] = useState("");
	const [sortField, setSortField] = useState<string | undefined>();
	const [sortOrder, setSortOrder] = useState<
		"ascend" | "descend" | undefined
	>();
	const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);

	/** 按当前条件刷新文件列表 */
	const refreshFiles = async (params?: {
		status?: string;
		keyword?: string;
		sortField?: string;
		sortOrder?: "ascend" | "descend";
		page?: number;
	}) => {
		try {
			const result = await getFileListSFn({
				data: {
					status: (params?.status ?? filter) || undefined,
					keyword: (params?.keyword ?? keyword) || undefined,
					sortField: params?.sortField ?? sortField,
					sortOrder: params?.sortOrder ?? sortOrder,
					page: params?.page,
				},
			});
			setData(result);
		} catch (err) {
			message.error(err instanceof Error ? err.message : "加载文件列表失败");
		}
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
		const order = s.order as "ascend" | "descend" | undefined;
		setSortField(field);
		setSortOrder(order);
		await refreshFiles({ sortField: field, sortOrder: order });
	};

	/** 上传核心逻辑（支持多文件并行上传） */
	const doUpload = async (
		file: File,
		onSuccess: (body: unknown) => void,
		onError: (err: Error) => void,
		permanent: boolean,
	) => {
		uploadingCountRef.current++;
		setUploading(true);
		try {
			const fd = new FormData();
			fd.append("file", file);
			fd.append("permanent", permanent ? "true" : "false");
			const result = await uploadFileSFn({ data: fd });
			if (result.success) {
				onSuccess?.(result.data);
			} else {
				onError?.(new Error("上传失败"));
			}
		} catch (err) {
			console.error("[文件上传失败]", err);
			onError?.(err as Error);
		} finally {
			uploadingCountRef.current--;
			if (uploadingCountRef.current === 0) {
				setUploading(false);
				message.success("上传完成");
				await refreshFiles();
				await router.invalidate();
			}
		}
	};

	/** 临时文件上传 */
	const tempRequest: UploadProps["customRequest"] = async (options) => {
		const { file, onSuccess, onError } = options;
		await doUpload(file as File, onSuccess!, onError!, false);
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
			width: 200,
		},
		{
			title: "大小",
			dataIndex: "size",
			key: "size",
			width: 120,
			sorter: true,
			render: (_: unknown, record: FileRecord) => formatSize(record.size),
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
									icon={<SwapOutlined style={{ color: "#52c41a" }} />}
									style={{ paddingInline: 4, color: "#52c41a" }}
									onClick={async () => {
										try {
											await makePermanentSFn({ data: { id: record.id } });
											message.success("已转为永久");
											await refreshFiles();
										} catch (err) {
											message.error(
												err instanceof Error ? err.message : "操作失败",
											);
										}
									}}
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
								onClick={() => setPreviewFile(record)}
							>
								预览
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
					<TableOperate.Delete
						onConfirm={async () => {
							try {
								await deleteFileSFn({ data: { id: record.id } });
								message.success("已删除");
								await refreshFiles();
							} catch (err) {
								message.error(err instanceof Error ? err.message : "删除失败");
							}
						}}
					/>
				</TableOperate>
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
						multiple
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
						multiple
						disabled={uploading}
						className="compact-dragger"
					>
						<p className="ant-upload-text">
							<ClockCircleOutlined style={{ marginRight: 6 }} />
							临时文件上传（7 天后过期）
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
					onChange={(value: string | number) => {
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
				dataSource={data.records}
				columns={columns}
				rowKey="id"
				locale={{ emptyText: "暂无文件" }}
				scroll={{ x: 1050 }}
				onChange={handleTableChange}
				pagination={{
					total: data.total,
					pageSize: data.pageSize,
					current: data.page,
					onChange: async (page) => {
						await refreshFiles({ page });
					},
				}}
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
						src={`/file/r/${previewFile.id}`}
						alt={previewFile.originalName}
						style={{ maxWidth: "80vw", maxHeight: "80vh" }}
					/>
				)}
			</Modal>
		</AdminPageContent>
	);
}
