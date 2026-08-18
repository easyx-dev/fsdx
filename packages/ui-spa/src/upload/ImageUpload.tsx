/**
 * 图片上传组件（基础组件，照片墙）：支持单/多图上传、拖拽排序、从文件库选择、画廊预览
 * 上传实现经 uploadFile 回调注入，文件库查询经 fetchFiles / readUrl 回调注入
 * value / onChange 兼容 antd Form.Item 直接注入
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { message } from "../antd-static";
import type { UploadFileFn } from "./FileUpload";
import { type ImageItem, PhotoWall } from "./PhotoWall";
import { type FetchFiles, SelectFileModal } from "./SelectFileModal";

interface ImageUploadProps {
	/** 文件 ID（单文件）或文件 ID 数组（多文件），兼容 Form.Item 注入 */
	value?: string | string[];
	/** 值变更回调，兼容 Form.Item 注入 */
	onChange?: (value: string | string[]) => void;
	/** 最大上传数量，默认 1 */
	maxCount?: number;
	/** 是否禁用 */
	disabled?: boolean;
	/** 接受的文件类型，默认 "image/*" */
	accept?: string;
	/** 上传为永久文件，默认 true；设为 false 则为临时文件（7 天后过期） */
	permanent?: boolean;
	/** 文件上传回调（宿主注入，如对接 uploadFileSFn） */
	uploadFile: UploadFileFn;
	/** 文件库查询回调（宿主注入，如对接 getFileListSFn） */
	fetchFiles: FetchFiles;
	/** 根据文件 ID 生成读取地址（宿主注入，用于内联预览/打开） */
	readUrl: (id: string) => string;
}

/** 将文件 ID 转为 ImageItem（用于展示已存在的文件） */
function idToImageItem(id: string, readUrl: (id: string) => string): ImageItem {
	return {
		uid: id,
		name: "",
		url: readUrl(id),
		status: "done",
	};
}

/** 将 value 转为 ImageItem[] */
function valueToItems(
	value: string | string[] | undefined,
	readUrl: (id: string) => string,
): ImageItem[] {
	if (!value) return [];
	const ids = Array.isArray(value) ? value : [value];
	return ids.filter(Boolean).map((id) => idToImageItem(id, readUrl));
}

/** 从 ImageItem 列表提取文件 ID */
function extractIds(list: ImageItem[]): string[] {
	return list.filter((f) => f.status === "done" && f.uid).map((f) => f.uid);
}

export function ImageUpload({
	value,
	onChange,
	maxCount = 1,
	disabled = false,
	accept = "image/*",
	permanent = true,
	uploadFile,
	fetchFiles,
	readUrl,
}: ImageUploadProps) {
	const [fileList, setFileList] = useState<ImageItem[]>(() =>
		valueToItems(value, readUrl),
	);
	const [selectModalOpen, setSelectModalOpen] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const isHoveredRef = useRef(false);
	const internalChangeRef = useRef(false);

	// 外部 value 变更时同步 fileList（如表单重置）
	useEffect(() => {
		if (internalChangeRef.current) {
			internalChangeRef.current = false;
			return;
		}
		setFileList(valueToItems(value, readUrl));
	}, [value, readUrl]);

	/** 通知外部值变更 */
	const emitChange = useCallback(
		(list: ImageItem[]) => {
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

	/** 上传单个文件 */
	const uploadItem = useCallback(
		async (file: File, tempUid: string) => {
			try {
				const result = await uploadFile(file, permanent);
				setFileList((prev) =>
					prev.map((item) =>
						item.uid === tempUid
							? {
									...item,
									uid: result.id,
									url: readUrl(result.id),
									status: "done" as const,
									name: result.originalName || item.name,
								}
							: item,
					),
				);
				// 触发 onChange，但需要等 setFileList 完成后的最新值
				setFileList((prev) => {
					const ids = extractIds(prev);
					internalChangeRef.current = true;
					if (maxCount === 1) {
						onChange?.(ids[0] || "");
					} else {
						onChange?.(ids);
					}
					return prev;
				});
				if (result.isDuplicated) {
					message.success("秒传成功（图片已存在）");
				}
			} catch (err) {
				console.error("[ImageUpload] 上传失败", err);
				setFileList((prev) => prev.filter((item) => item.uid !== tempUid));
				message.error("上传失败：网络错误");
			}
		},
		[permanent, maxCount, onChange, uploadFile, readUrl],
	);

	/** 处理待上传文件（校验 + 创建临时条目 + 开始上传） */
	const processFiles = useCallback(
		(files: File[]) => {
			if (files.length === 0) return;
			for (const file of files) {
				if (!file.type.startsWith("image/")) {
					message.error(`"${file.name}" 不是图片文件`);
					return;
				}
				if (file.size > 10 * 1024 * 1024) {
					message.error(`"${file.name}" 超过 10MB 限制`);
					return;
				}
			}
			const available =
				maxCount <= 1 ? 1 - fileList.length : maxCount - fileList.length;
			const toUpload = files.slice(0, Math.max(0, available));
			if (files.length > available) {
				message.warning(`最多还能上传 ${available} 张图片，已自动截取`);
			}
			if (toUpload.length === 0) return;
			const tempItems: ImageItem[] = toUpload.map((f) => ({
				uid: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
				name: f.name,
				url: URL.createObjectURL(f),
				status: "uploading" as const,
			}));
			setFileList((prev) => [...prev, ...tempItems]);
			for (let i = 0; i < toUpload.length; i++) {
				uploadItem(toUpload[i], tempItems[i].uid);
			}
		},
		[fileList.length, maxCount, uploadItem],
	);

	/** 文件选择变更 */
	const handleInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const files = Array.from(e.target.files ?? []);
			e.target.value = "";
			processFiles(files);
		},
		[processFiles],
	);

	/** 拖拽上传 */
	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setDragOver(false);
			const files = Array.from(e.dataTransfer.files);
			processFiles(files);
		},
		[processFiles],
	);

	// 全局粘贴上传监听（仅悬停时响应）
	useEffect(() => {
		const handlePaste = (e: ClipboardEvent) => {
			if (disabled || !isHoveredRef.current) return;
			const items = e.clipboardData?.files;
			if (!items || items.length === 0) return;
			const imageFiles = Array.from(items).filter((f) =>
				f.type.startsWith("image/"),
			);
			if (imageFiles.length > 0) {
				e.preventDefault();
				processFiles(imageFiles);
			}
		};
		document.addEventListener("paste", handlePaste);
		return () => document.removeEventListener("paste", handlePaste);
	}, [disabled, processFiles]);

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
			const newItems = newIds.map((id) => idToImageItem(id, readUrl));
			emitChange([...fileList, ...newItems]);
		},
		[fileList, maxCount, emitChange, readUrl],
	);

	/** 拖拽排序 */
	const handleDragSort = useCallback(
		(dragIndex: number, hoverIndex: number) => {
			const newList = [...fileList];
			const [dragged] = newList.splice(dragIndex, 1);
			newList.splice(hoverIndex, 0, dragged);
			emitChange(newList);
			setSortKey((k) => k + 1);
		},
		[fileList, emitChange],
	);

	/** 删除文件 */
	const handleRemove = useCallback(
		(index: number) => {
			const item = fileList[index];
			if (item?.url?.startsWith("blob:")) {
				URL.revokeObjectURL(item.url);
			}
			const newList = fileList.filter((_, i) => i !== index);
			emitChange(newList);
			setSortKey((k) => k + 1);
		},
		[fileList, emitChange],
	);

	const canAdd =
		maxCount <= 1 ? fileList.length < 1 : fileList.length < maxCount;
	const canSort = maxCount > 1 && fileList.length > 1;
	// 拖拽视觉状态
	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const [hoverIndex, setHoverIndex] = useState<number | null>(null);
	const [hoveredCard, setHoveredCard] = useState<number | null>(null);
	const [dragOver, setDragOver] = useState(false);
	const [sortKey, setSortKey] = useState(0);

	return (
		<>
			{/* 隐藏的文件选择 input */}
			<input
				ref={inputRef}
				type="file"
				accept={accept}
				multiple={maxCount > 1}
				onChange={handleInputChange}
				style={{ display: "none" }}
			/>

			<div
				style={{ display: "flex", flexDirection: "column", gap: 8 }}
				onMouseEnter={() => {
					isHoveredRef.current = true;
				}}
				onMouseLeave={() => {
					isHoveredRef.current = false;
				}}
			>
				<PhotoWall
					fileList={fileList}
					canAdd={canAdd}
					canSort={canSort}
					disabled={disabled}
					dragIndex={dragIndex}
					hoverIndex={hoverIndex}
					hoveredCard={hoveredCard}
					dragOver={dragOver}
					sortKey={sortKey}
					inputRef={inputRef}
					onHoverCard={setHoveredCard}
					onDragStart={setDragIndex}
					onDragEnd={() => {
						setDragIndex(null);
						setHoverIndex(null);
					}}
					onDragEnter={setHoverIndex}
					onDragLeave={() => setHoverIndex(null)}
					onDragSort={handleDragSort}
					onRemove={handleRemove}
					onDrop={handleDrop}
					onDragOverToggle={setDragOver}
					onLibraryClick={() => setSelectModalOpen(true)}
				/>
			</div>

			<SelectFileModal
				open={selectModalOpen}
				onCancel={() => setSelectModalOpen(false)}
				onSelect={handleLibrarySelect}
				multiple={maxCount > 1}
				accept={accept}
				maxCount={maxCount}
				fetchFiles={fetchFiles}
				readUrl={readUrl}
			/>
		</>
	);
}
