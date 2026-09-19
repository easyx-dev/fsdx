/**
 * 文件管理页面：上传、列表、下载、删除、秒传
 */
import {
	ClockCircleOutlined,
	CloudUploadOutlined,
	EditOutlined,
} from "@ant-design/icons";
import { isImageMimeType, isProcessableMimeType } from "@easyx/image-toolkit";
import { message } from "@fsdx/ui-spa/antd-static";
import { ProTable } from "@fsdx/ui-spa/table";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import type { TableProps, UploadProps } from "antd";
import { Button, Col, Input, Modal, Row, Segmented, Upload } from "antd";
import { useRef, useState } from "react";
import { AdminPageContent } from "#/components/admin";
import { getFileListSFn, uploadFileSFn } from "#/services/file/file.functions";
import type { FileRecord } from "#/services/file/file.server";
import { callSfn } from "#/utils/sfn-error";
import { FileImageEditor } from "./-mods/FileImageEditor";
import { deleteFileSFn, makePermanentSFn } from "./-mods/files.functions";
import { createFilesColumns } from "./-mods/filesColumns";

export const Route = createFileRoute("/admin/_admin/files/")({
	component: FilesPage,
	loader: async () => await getFileListSFn({ data: {} }),
});

function FilesPage() {
	const router = useRouter();
	const initialData = Route.useLoaderData();
	const [data, setData] = useState(initialData);
	const [filter, setFilter] = useState<"" | "temp" | "permanent">("");
	const uploadingCountRef = useRef(0);
	const [uploading, setUploading] = useState(false);
	const [keyword, setKeyword] = useState("");
	const [sortField, setSortField] = useState<string>();
	const [sortOrder, setSortOrder] = useState<
		"ascend" | "descend" | undefined
	>();
	const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);
	/** 待编辑图片（非 null 时打开图片编辑器） */
	const [editingFile, setEditingFile] = useState<FileRecord | null>(null);

	/** 按当前条件刷新文件列表 */
	const refreshFiles = async (params?: {
		status?: "" | "temp" | "permanent";
		keyword?: string;
		sortField?: string;
		sortOrder?: "ascend" | "descend";
		page?: number;
	}) => {
		try {
			const result = await callSfn(
				getFileListSFn({
					data: {
						status: (params?.status ?? filter) || undefined,
						keyword: (params?.keyword ?? keyword) || undefined,
						sortField: params?.sortField ?? sortField,
						sortOrder: params?.sortOrder ?? sortOrder,
						page: params?.page,
					},
				}),
			);
			setData(result);
		} catch {
			// callSfn 已提示
		}
	};

	/** 切换筛选状态并刷新列表 */
	const handleFilterChange = async (status: "" | "temp" | "permanent") => {
		setFilter(status);
		await refreshFiles({ status });
	};

	/** 按关键词搜索 */
	const handleSearch = async (value: string) => {
		setKeyword(value);
		await refreshFiles({ keyword: value });
	};

	/** 表格排序变更 */
	const handleTableChange: TableProps<FileRecord>["onChange"] = async (
		_pagination,
		_filters,
		sorter,
	) => {
		const s = Array.isArray(sorter) ? sorter[0] : sorter;
		const field = typeof s?.field === "string" ? s.field : undefined;
		const order =
			s?.order === "ascend" || s?.order === "descend" ? s.order : undefined;
		setSortField(field);
		setSortOrder(order);
		await refreshFiles({ sortField: field, sortOrder: order });
	};

	/** 上传核心逻辑（支持多文件并行上传） */
	const doUpload = async (
		file: File,
		permanent: boolean,
		onSuccess?: (body: unknown) => void,
		onError?: (err: Error) => void,
	) => {
		uploadingCountRef.current++;
		setUploading(true);
		try {
			const fd = new FormData();
			fd.append("file", file);
			fd.append("permanent", permanent ? "true" : "false");
			const result = await callSfn(uploadFileSFn({ data: fd }));
			if (result.success) {
				onSuccess?.(result.data);
			} else {
				onError?.(new Error("上传失败"));
			}
		} catch (err) {
			// callSfn 已统一提示；保留排查日志，并通知 antd Upload 标记失败项
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
		await doUpload(file as File, false, onSuccess, onError);
	};

	/** 永久文件上传 */
	const permanentRequest: UploadProps["customRequest"] = async (options) => {
		const { file, onSuccess, onError } = options;
		await doUpload(file as File, true, onSuccess, onError);
	};

	/** 临时文件转永久 */
	const handleMakePermanent = async (record: FileRecord) => {
		try {
			await callSfn(makePermanentSFn({ data: { id: record.id } }));
			message.success("已转为永久");
			await refreshFiles();
		} catch {
			// callSfn 已提示
		}
	};

	/** 删除文件 */
	const handleDelete = async (record: FileRecord) => {
		try {
			await callSfn(deleteFileSFn({ data: { id: record.id } }));
			message.success("已删除");
			await refreshFiles();
		} catch {
			// callSfn 已提示
		}
	};

	const columns = createFilesColumns({
		onPreview: setPreviewFile,
		onEdit: setEditingFile,
		onMakePermanent: handleMakePermanent,
		onDelete: handleDelete,
	});

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
						handleFilterChange(value as "" | "temp" | "permanent");
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
				onCancel={() => setPreviewFile(null)}
				width="auto"
				centered
				footer={
					previewFile && isProcessableMimeType(previewFile.mimeType) ? (
						<Button
							type="primary"
							icon={<EditOutlined />}
							onClick={() => {
								setEditingFile(previewFile);
								setPreviewFile(null);
							}}
						>
							编辑图片
						</Button>
					) : null
				}
			>
				{previewFile && isImageMimeType(previewFile.mimeType) && (
					<img
						src={`/file/r/${previewFile.id}`}
						alt={previewFile.originalName}
						style={{ maxWidth: "80vw", maxHeight: "80vh" }}
					/>
				)}
			</Modal>

			{/* 图片编辑器：裁切与压缩在浏览器完成，保存时写回服务端 */}
			<FileImageEditor
				file={editingFile}
				onClose={() => setEditingFile(null)}
				onSaved={() => {
					void refreshFiles();
				}}
			/>
		</AdminPageContent>
	);
}
