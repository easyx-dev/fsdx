/**
 * 文件库选择弹窗：从已上传文件中选取，支持搜索、筛选、预览、单选/多选、分页
 */
import { EyeOutlined } from "@ant-design/icons";
import { message } from "@fsdx/ui-spa/antd-static";
import { ProTable } from "@fsdx/ui-spa/pro-table";
import { Button, Image, Input, Modal, Space, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useEffect, useRef, useState } from "react";
import { getFileListSFn } from "#/services/file/file.functions";
import type { FileRecord } from "#/services/file/file.server";

interface SelectFileModalProps {
	/** 弹窗是否可见 */
	open: boolean;
	/** 关闭弹窗回调 */
	onCancel: () => void;
	/** 确认选择回调，返回选中的文件 ID 数组 */
	onSelect: (fileIds: string[]) => void;
	/** 是否多选 */
	multiple?: boolean;
	/** 文件类型过滤，如 "image/*" 仅显示图片；不传显示全部 */
	accept?: string;
	/** 最大选择数量，多选模式下生效 */
	maxCount?: number;
}

/** 将 accept 值转为 mimeType 前缀（如 "image/*" → "image/"） */
function acceptToMimePrefix(accept?: string): string | undefined {
	if (!accept) return undefined;
	if (accept === "image/*") return "image/";
	if (accept.endsWith("/*")) return accept.replace("/*", "/");
	return accept;
}

/** 格式化文件大小 */
function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SelectFileModal({
	open,
	onCancel,
	onSelect,
	multiple = false,
	accept,
	maxCount,
}: SelectFileModalProps) {
	const pageSize = 50;
	const [loading, setLoading] = useState(false);
	const [records, setRecords] = useState<FileRecord[]>([]);
	const [total, setTotal] = useState(0);
	const [page, setPage] = useState(1);
	const [keyword, setKeyword] = useState("");
	const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
	const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);
	const keywordRef = useRef(keyword);
	keywordRef.current = keyword;

	const mimePrefix = acceptToMimePrefix(accept);

	/** 加载文件列表（服务端分页） */
	const fetchFiles = useCallback(
		async (params?: { page?: number; keyword?: string }) => {
			setLoading(true);
			try {
				const kw = params?.keyword ?? keywordRef.current;
				const pg = params?.page ?? 1;
				const result = await getFileListSFn({
					data: {
						keyword: kw || undefined,
						mimePrefix,
						page: pg,
						pageSize,
					},
				});
				setRecords(result.records ?? []);
				setTotal(result.total);
			} catch (err) {
				console.error("[SelectFileModal] 加载文件列表失败", err);
				message.error("加载文件列表失败");
			} finally {
				setLoading(false);
			}
		},
		[mimePrefix],
	);

	useEffect(() => {
		if (open) {
			setPage(1);
			setKeyword("");
			setSelectedRowKeys([]);
			fetchFiles({ page: 1, keyword: "" });
		}
	}, [open, fetchFiles]);

	const columns: ColumnsType<FileRecord> = [
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
			render: (_: unknown, r: FileRecord) => formatSize(r.size),
		},
		{
			title: "状态",
			dataIndex: "status",
			key: "status",
			width: 80,
			render: (_: unknown, r: FileRecord) =>
				r.status === "permanent" ? (
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
			render: (_: unknown, r: FileRecord) =>
				r.createdAt ? new Date(r.createdAt).toLocaleString("zh-CN") : "-",
		},
		{
			title: "操作",
			key: "actions",
			width: 80,
			render: (_: unknown, r: FileRecord) =>
				r.mimeType.startsWith("image/") ? (
					<TableOperate>
						<TableOperate.Custom>
							<Button
								type="link"
								size="small"
								icon={<EyeOutlined />}
								onClick={() => setPreviewFile(r)}
							>
								预览
							</Button>
						</TableOperate.Custom>
					</TableOperate>
				) : null,
		},
	];

	const handleSearch = (value: string) => {
		setKeyword(value);
		setPage(1);
		fetchFiles({ keyword: value, page: 1 });
	};

	const handlePageChange = (p: number) => {
		setPage(p);
		fetchFiles({ page: p });
	};

	const handleConfirm = () => {
		onSelect(selectedRowKeys);
		onCancel();
	};

	return (
		<Modal
			title="从文件库选择"
			open={open}
			onCancel={onCancel}
			width={780}
			centered
			footer={
				<Space>
					<Button onClick={onCancel}>取消</Button>
					<Button type="primary" onClick={handleConfirm}>
						确定选择
					</Button>
				</Space>
			}
			destroyOnClose
		>
			<div style={{ marginBottom: 16 }}>
				<Input.Search
					placeholder="搜索文件名..."
					allowClear
					onSearch={handleSearch}
					style={{ width: 300 }}
				/>
			</div>
			<ProTable<FileRecord>
				rowKey="id"
				onRow={(record) => ({
					onClick: () => {
						if (multiple) {
							setSelectedRowKeys((prev) => {
								if (prev.includes(record.id)) {
									return prev.filter((k) => k !== record.id);
								}
								if (maxCount && prev.length >= maxCount) {
									message.warning(`最多选择 ${maxCount} 个文件`);
									return prev;
								}
								return [...prev, record.id];
							});
						} else {
							setSelectedRowKeys([record.id]);
						}
					},
					onDoubleClick: () => {
						if (!multiple) {
							onSelect([record.id]);
							onCancel();
						}
					},
				})}
				columns={columns}
				dataSource={records}
				loading={loading}
				size="small"
				rowSelection={
					multiple
						? {
								type: "checkbox",
								selectedRowKeys,
								onChange: (keys) => {
									const k = keys as string[];
									if (maxCount && k.length > maxCount) {
										message.warning(`最多选择 ${maxCount} 个文件`);
										return;
									}
									setSelectedRowKeys(k);
								},
							}
						: {
								type: "radio",
								selectedRowKeys,
								onChange: (keys) => setSelectedRowKeys(keys as string[]),
							}
				}
				pagination={{
					total,
					pageSize,
					current: page,
					onChange: handlePageChange,
					size: "small",
					showTotal: (t) => `共 ${t} 条`,
				}}
			/>
			{previewFile && (
				<Modal
					open={!!previewFile}
					title={previewFile.originalName}
					footer={null}
					onCancel={() => setPreviewFile(null)}
					width="auto"
					centered
				>
					<Image
						preview={false}
						src={`/api/download/file/${previewFile.id}`}
						alt={previewFile.originalName}
						style={{ maxWidth: "70vw", maxHeight: "70vh" }}
					/>
				</Modal>
			)}
		</Modal>
	);
}

import { TableOperate } from "@fsdx/ui-spa/table-operate";
