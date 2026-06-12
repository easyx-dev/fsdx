/**
 * 图片上传组件（照片墙）：支持单/多图上传、拖拽排序、从文件库选择、画廊预览
 * value / onChange 兼容 antd Form.Item 直接注入
 */
import {
	DeleteOutlined,
	FolderOpenOutlined,
	PlusOutlined,
} from "@ant-design/icons";
import { Button, Image, message, Spin } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { uploadFileSFn } from "#/server/file/file.functions";
import { SelectFileModal } from "./SelectFileModal";

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
}

interface ImageItem {
	uid: string;
	name: string;
	url: string;
	status: "done" | "uploading" | "error";
}

/** 将文件 ID 转为 ImageItem（用于展示已存在的文件） */
function idToImageItem(id: string): ImageItem {
	return {
		uid: id,
		name: "",
		url: `/api/download/file/${id}`,
		status: "done",
	};
}

/** 将 value 转为 ImageItem[] */
function valueToItems(value?: string | string[]): ImageItem[] {
	if (!value) return [];
	const ids = Array.isArray(value) ? value : [value];
	return ids.filter(Boolean).map(idToImageItem);
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
}: ImageUploadProps) {
	const [fileList, setFileList] = useState<ImageItem[]>(() =>
		valueToItems(value),
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
		setFileList(valueToItems(value));
	}, [value]);

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
	const uploadFile = useCallback(
		async (file: File, tempUid: string) => {
			try {
				const fd = new FormData();
				fd.append("file", file);
				if (permanent) fd.append("permanent", "true");
				const result = await uploadFileSFn({ data: fd });
				if (result.success && result.data.id) {
					setFileList((prev) =>
						prev.map((item) =>
							item.uid === tempUid
								? {
										...item,
										uid: result.data.id,
										url: `/api/download/file/${result.data.id}`,
										status: "done" as const,
										name: result.data.originalName || item.name,
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
					if (result.data.isDuplicated) {
						message.success("秒传成功（图片已存在）");
					}
				} else {
					setFileList((prev) => prev.filter((item) => item.uid !== tempUid));
					message.error("上传失败");
				}
			} catch (err) {
				console.error("[ImageUpload] 上传失败", err);
				setFileList((prev) => prev.filter((item) => item.uid !== tempUid));
				message.error("上传失败：网络错误");
			}
		},
		[permanent, maxCount, onChange],
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
				uploadFile(toUpload[i], tempItems[i].uid);
			}
		},
		[fileList.length, maxCount, uploadFile],
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
			const newItems = newIds.map(idToImageItem);
			emitChange([...fileList, ...newItems]);
		},
		[fileList, maxCount, emitChange],
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
				{/* 照片墙网格 */}
				<div
					style={{
						display: "flex",
						flexWrap: "wrap",
						gap: 8,
						alignItems: "flex-start",
					}}
				>
					<Image.PreviewGroup key={sortKey}>
						{fileList.map((item, index) => (
							<div
								key={item.uid}
								onMouseEnter={() => setHoveredCard(index)}
								onMouseLeave={() => setHoveredCard(null)}
								draggable={canSort}
								onDragStart={
									canSort
										? (e) => {
												setDragIndex(index);
												e.dataTransfer.setData("text/plain", String(index));
												e.dataTransfer.effectAllowed = "move";
											}
										: undefined
								}
								onDragEnd={() => {
									setDragIndex(null);
									setHoverIndex(null);
								}}
								onDragEnter={canSort ? () => setHoverIndex(index) : undefined}
								onDragLeave={canSort ? () => setHoverIndex(null) : undefined}
								onDragOver={
									canSort
										? (e) => {
												e.preventDefault();
												e.dataTransfer.dropEffect = "move";
											}
										: undefined
								}
								onDrop={
									canSort
										? (e) => {
												e.preventDefault();
												const from = Number(
													e.dataTransfer.getData("text/plain"),
												);
												if (from !== index && !Number.isNaN(from)) {
													handleDragSort(from, index);
												}
											}
										: undefined
								}
								style={{
									width: 104,
									height: 104,
									border: "1px solid #d9d9d9",
									borderRadius: 8,
									overflow: "hidden",
									position: "relative",
									cursor: canSort ? "move" : "default",
									opacity: dragIndex === index ? 0.4 : 1,
									borderColor:
										canSort && hoverIndex === index ? "#1677ff" : "#d9d9d9",
									borderWidth: canSort && hoverIndex === index ? 2 : 1,
									transition: "opacity 0.15s, border-color 0.15s",
								}}
							>
								<Image
									src={item.url}
									width={104}
									height={104}
									style={{ objectFit: "cover" }}
									preview={{
										mask: (
											<div
												style={{
													display: "flex",
													alignItems: "center",
													justifyContent: "center",
													height: "100%",
													fontSize: 12,
													color: "#fff",
												}}
											>
												预览
											</div>
										),
									}}
								/>
								{item.status === "uploading" && (
									<div
										style={{
											position: "absolute",
											inset: 0,
											background: "rgba(255,255,255,0.7)",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
										}}
									>
										<Spin size="small" />
									</div>
								)}
								{/* 删除按钮（hover 显示） */}
								<div
									className="image-upload-item-actions"
									style={{
										position: "absolute",
										top: 2,
										right: 2,
										opacity: hoveredCard === index ? 1 : 0,
										transition: "opacity 0.15s",
									}}
									onClick={(e) => {
										e.stopPropagation();
										e.preventDefault();
									}}
								>
									<Button
										type="text"
										size="small"
										danger
										icon={<DeleteOutlined />}
										style={{
											color: "#fff",
											background: "rgba(255,77,79,0.7)",
											borderRadius: 4,
										}}
										onClick={(e) => {
											e.stopPropagation();
											handleRemove(index);
										}}
									/>
								</div>
							</div>
						))}
					</Image.PreviewGroup>

					{/* 上传 + 文件库选择 合并卡片 */}
					{canAdd && !disabled && (
						<div
							onDragOver={(e) => {
								e.preventDefault();
								e.dataTransfer.dropEffect = "copy";
							}}
							onDragEnter={(e) => {
								e.preventDefault();
								setDragOver(true);
							}}
							onDragLeave={(e) => {
								e.preventDefault();
								setDragOver(false);
							}}
							onDrop={handleDrop}
							style={{
								width: 104,
								height: 104,
								border: "1px dashed #d9d9d9",
								borderRadius: 8,
								display: "flex",
								flexDirection: "column",
								overflow: "hidden",
								borderColor: dragOver ? "#1677ff" : "#d9d9d9",
								background: dragOver ? "#e6f4ff" : "#fafafa",
								transition: "border-color 0.15s, background 0.15s",
							}}
						>
							{/* 上传图片区域 */}
							<div
								onClick={() => inputRef.current?.click()}
								style={{
									flex: 1,
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									justifyContent: "center",
									cursor: "pointer",
									color: "#999",
								}}
								onMouseEnter={(e) => {
									const el = e.currentTarget as HTMLElement;
									el.style.color = "#1677ff";
									const parent = el.parentElement;
									if (parent) parent.style.borderColor = "#1677ff";
								}}
								onMouseLeave={(e) => {
									const el = e.currentTarget as HTMLElement;
									el.style.color = "#999";
									const parent = el.parentElement;
									if (parent) parent.style.borderColor = "#d9d9d9";
								}}
							>
								<PlusOutlined style={{ fontSize: 20 }} />
								<div style={{ fontSize: 12, marginTop: 4 }}>上传图片</div>
							</div>
							{/* 从文件库选择区域 */}
							<div
								onClick={(e) => {
									e.stopPropagation();
									setSelectModalOpen(true);
								}}
								style={{
									height: 28,
									borderTop: "1px dashed #d9d9d9",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									cursor: "pointer",
									fontSize: 12,
									color: "#999",
									background: "#f5f5f5",
								}}
								onMouseEnter={(e) => {
									const el = e.currentTarget as HTMLElement;
									el.style.color = "#fff";
									el.style.background = "#1677ff";
									el.style.borderTopColor = "#1677ff";
								}}
								onMouseLeave={(e) => {
									const el = e.currentTarget as HTMLElement;
									el.style.color = "#999";
									el.style.background = "#f5f5f5";
									el.style.borderTopColor = "#d9d9d9";
								}}
							>
								<FolderOpenOutlined style={{ fontSize: 12, marginRight: 4 }} />
								从文件库选择
							</div>
						</div>
					)}
				</div>
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
