/**
 * 文件上传组件：支持拖拽上传 / 按钮点击上传、从文件库选择、拖拽排序
 * value / onChange 兼容 antd Form.Item 直接注入
 */
import {
	FolderOpenOutlined,
	InboxOutlined,
	UploadOutlined,
} from "@ant-design/icons";
import { renderUploadItem } from "@fsdx/ui-spa/upload/file-upload-render";
import type { UploadFile, UploadProps } from "antd";
import { Button, Input, Space, Upload } from "antd";
import type { MouseEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { message } from "#/components/antd-static";
import { uploadFileSFn } from "#/services/file/file.functions";
import { SelectFileModal } from "../SelectFileModal";

interface FileUploadProps {
	/** 文件 ID（单文件）或文件 ID 数组（多文件），兼容 Form.Item 注入 */
	value?: string | string[];
	/** 值变更回调，兼容 Form.Item 注入 */
	onChange?: (value: string | string[]) => void;
	/** 最大上传数量，默认 1 */
	maxCount?: number;
	/** 是否禁用 */
	disabled?: boolean;
	/** 接受的文件类型，不传允许所有类型 */
	accept?: string;
	/** 上传模式：drag 为拖拽区，button 为按钮点击 */
	type?: "drag" | "button";
	/** 上传列表样式：text（文件列表）、picture（缩略图列表） */
	listType?: "text" | "picture";
	/** 上传为永久文件，默认 true；设为 false 则为临时文件（7 天后过期） */
	permanent?: boolean;
}

/** 将文件 ID 转为 UploadFile 对象（用于展示） */
function idToUploadFile(id: string): UploadFile {
	return {
		uid: id,
		name: id,
		status: "done",
		url: `/api/download/file/${id}`,
	};
}

/** 将 value 转为 UploadFile[] */
function valueToFileList(value?: string | string[]): UploadFile[] {
	if (!value) return [];
	const ids = Array.isArray(value) ? value : [value];
	return ids.filter(Boolean).map(idToUploadFile);
}

/** 从 UploadFile 列表提取文件 ID */
function extractIds(list: UploadFile[]): string[] {
	return list.filter((f) => f.status === "done" && f.uid).map((f) => f.uid);
}

export function FileUpload({
	value,
	onChange,
	maxCount = 1,
	disabled = false,
	accept,
	type = "drag",
	listType = "text",
	permanent = true,
}: FileUploadProps) {
	const [fileList, setFileList] = useState<UploadFile[]>(() =>
		valueToFileList(value),
	);
	const [selectModalOpen, setSelectModalOpen] = useState(false);
	const internalChangeRef = useRef(false);
	const isHoveredRef = useRef(false);
	const containerRef = useRef<HTMLDivElement>(null);

	// 外部 value 变更时同步 fileList（如表单重置）
	useEffect(() => {
		if (internalChangeRef.current) {
			internalChangeRef.current = false;
			return;
		}
		setFileList(valueToFileList(value));
	}, [value]);

	/** 通知外部值变更 */
	const emitChange = useCallback(
		(list: UploadFile[]) => {
			const ids = extractIds(list);
			internalChangeRef.current = true;
			setFileList(list);
			if (maxCount === 1) {
				onChange?.(ids[0] || "");
			} else {
				onChange?.(ids);
			}
		},
		[onChange, maxCount],
	);

	/** 上传前校验 */
	const beforeUpload = useCallback(
		(file: File) => {
			const isLt50M = file.size / 1024 / 1024 < 50;
			if (!isLt50M) {
				message.error("文件大小不能超过 50MB");
				return Upload.LIST_IGNORE;
			}
			if (maxCount > 1 && fileList.length >= maxCount) {
				message.error(`最多上传 ${maxCount} 个文件`);
				return Upload.LIST_IGNORE;
			}
			return true;
		},
		[maxCount, fileList.length],
	);

	/** 自定义上传请求 */
	const customRequest: UploadProps["customRequest"] = async (options) => {
		const { file, onSuccess, onError, onProgress } = options;
		try {
			onProgress?.({ percent: 0 } as Parameters<
				NonNullable<typeof onProgress>
			>[0]);
			const fd = new FormData();
			fd.append("file", file as File);
			if (permanent) fd.append("permanent", "true");
			const result = await uploadFileSFn({ data: fd });
			if (result.success) {
				onProgress?.({ percent: 100 } as Parameters<
					NonNullable<typeof onProgress>
				>[0]);
				onSuccess?.(result.data);
				if (result.data.isDuplicated) {
					message.success("秒传成功（文件已存在）");
				}
			} else {
				onError?.(new Error("上传失败"));
				message.error("上传失败");
			}
		} catch (err) {
			onError?.(err as Error);
			message.error("上传失败：网络错误");
		}
	};

	/** antd Upload onChange 回调 */
	const handleChange: UploadProps["onChange"] = (info) => {
		let newFileList = info.fileList.filter((f) => f.status !== "removed");
		newFileList = newFileList.map((f) => {
			if (f.response) {
				return {
					...f,
					uid: f.response?.id || f.uid,
					name: f.response?.originalName || f.name,
					url: f.response?.id ? `/api/download/file/${f.response.id}` : f.url,
				};
			}
			return f;
		});
		emitChange(newFileList);
	};

	/** 文件库选择确认 */
	const handleLibrarySelect = useCallback(
		(ids: string[]) => {
			const existingIds = new Set(extractIds(fileList));
			const newIds = ids.filter((id) => !existingIds.has(id));
			if (newIds.length === 0) {
				message.info("所选文件已存在列表中");
				return;
			}
			const available = maxCount > 1 ? maxCount - fileList.length : 1;
			if (newIds.length > available) {
				message.warning(`最多还能添加 ${available} 个文件`);
				return;
			}
			const newFiles = newIds.map(idToUploadFile);
			emitChange([...fileList, ...newFiles]);
		},
		[fileList, maxCount, emitChange],
	);

	/** 拖拽排序处理 */
	const handleDragSort = useCallback(
		(dragIndex: number, hoverIndex: number) => {
			const newList = [...fileList];
			const [draggedItem] = newList.splice(dragIndex, 1);
			newList.splice(hoverIndex, 0, draggedItem);
			emitChange(newList);
		},
		[fileList, emitChange],
	);

	/** 自定义上传列表项：支持拖拽排序 + 删除 */
	const itemRender: UploadProps["itemRender"] = (
		originNode,
		file,
		_list,
		actions,
	) => {
		const index = fileList.findIndex((f) => f.uid === file.uid);
		const canSort = maxCount > 1 && fileList.length > 1;
		return renderUploadItem(
			originNode,
			index,
			actions,
			canSort,
			handleDragSort,
		);
	};

	/** 是否可以继续添加 */
	const canAdd =
		maxCount <= 1 ? fileList.length < 1 : fileList.length < maxCount;

	// 粘贴上传（仅悬停时响应）
	useEffect(() => {
		const handlePaste = (e: ClipboardEvent) => {
			if (disabled || !isHoveredRef.current) return;
			const files = e.clipboardData?.files;
			if (!files || files.length === 0) return;
			e.preventDefault();
			const input = containerRef.current?.querySelector('input[type="file"]');
			if (input) {
				const dt = new DataTransfer();
				for (const f of files) dt.items.add(f);
				(input as HTMLInputElement).files = dt.files;
				input.dispatchEvent(new Event("change", { bubbles: true }));
			}
		};
		document.addEventListener("paste", handlePaste);
		return () => document.removeEventListener("paste", handlePaste);
	}, [disabled]);

	/** 单文件紧凑模式：Input + 上传按钮 + 文件库选择 */
	const renderCompactMode = () => {
		const fileName = fileList[0]?.name || "";

		return (
			<Space.Compact style={{ width: "100%" }}>
				<Input
					readOnly
					value={fileName ? `📄 ${fileName}` : ""}
					placeholder="请选择文件"
					disabled={disabled}
					style={{ flex: 1 }}
				/>
				<Upload
					fileList={fileList}
					onChange={handleChange}
					customRequest={customRequest}
					beforeUpload={beforeUpload}
					accept={accept}
					disabled={disabled}
					maxCount={1}
					showUploadList={false}
				>
					<Button type="primary" icon={<UploadOutlined />} disabled={disabled}>
						上传文件
					</Button>
				</Upload>
				<Button
					icon={<FolderOpenOutlined />}
					disabled={disabled}
					onClick={() => setSelectModalOpen(true)}
				>
					选择
				</Button>
			</Space.Compact>
		);
	};

	const renderUploadArea = () => {
		if (type === "drag") {
			return (
				<Upload.Dragger
					fileList={fileList}
					onChange={handleChange}
					customRequest={customRequest}
					beforeUpload={beforeUpload}
					accept={accept}
					disabled={disabled || !canAdd}
					maxCount={maxCount}
					multiple={maxCount > 1}
					listType={listType}
					itemRender={itemRender}
					showUploadList={{ showPreviewIcon: false }}
				>
					<p className="ant-upload-drag-icon">
						<InboxOutlined />
					</p>
					<p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
					<p className="ant-upload-hint">
						{accept && (
							<>
								<span>支持类型：{accept}</span>
								<span> ｜ </span>
							</>
						)}
						<span
							onClick={(e) => {
								e.stopPropagation();
								setSelectModalOpen(true);
							}}
							style={{
								cursor: "pointer",
								color: "var(--s-primary)",
								textDecoration: "underline",
							}}
						>
							<FolderOpenOutlined style={{ marginRight: 4 }} />
							从文件库选择
						</span>
					</p>
				</Upload.Dragger>
			);
		}

		return (
			<Upload
				fileList={fileList}
				onChange={handleChange}
				customRequest={customRequest}
				beforeUpload={beforeUpload}
				accept={accept}
				disabled={disabled || !canAdd}
				maxCount={maxCount}
				multiple={maxCount > 1}
				listType={listType}
				itemRender={itemRender}
				showUploadList={{ showPreviewIcon: false }}
			>
				{canAdd && (
					<Space.Compact>
						<Button
							type="primary"
							icon={<UploadOutlined />}
							disabled={disabled}
						>
							上传文件
						</Button>
						<Button
							icon={<FolderOpenOutlined />}
							disabled={disabled}
							onClick={(e: MouseEvent<HTMLElement>) => {
								e.stopPropagation();
								setSelectModalOpen(true);
							}}
						>
							从文件库选择
						</Button>
					</Space.Compact>
				)}
			</Upload>
		);
	};

	return (
		<>
			<div
				ref={containerRef}
				style={{ display: "flex", flexDirection: "column", gap: 8 }}
				onMouseEnter={() => {
					isHoveredRef.current = true;
				}}
				onMouseLeave={() => {
					isHoveredRef.current = false;
				}}
			>
				{maxCount === 1 ? renderCompactMode() : renderUploadArea()}
			</div>

			<SelectFileModal
				open={selectModalOpen}
				onCancel={() => setSelectModalOpen(false)}
				onSelect={handleLibrarySelect}
				multiple={maxCount > 1}
				accept={accept}
				maxCount={maxCount}
			/>
		</>
	);
}
