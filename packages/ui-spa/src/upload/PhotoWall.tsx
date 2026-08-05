/**
 * 照片墙网格 + 上传/文件库选择卡片
 */
import {
	DeleteOutlined,
	FolderOpenOutlined,
	PlusOutlined,
} from "@ant-design/icons";
import { Button, Image, Spin } from "antd";

/** 图片条目：照片墙与上传组件共享 */
export interface ImageItem {
	uid: string;
	name: string;
	url: string;
	status: "done" | "uploading" | "error";
}

interface PhotoWallProps {
	fileList: ImageItem[];
	canAdd: boolean;
	canSort: boolean;
	disabled: boolean;
	dragIndex: number | null;
	hoverIndex: number | null;
	hoveredCard: number | null;
	dragOver: boolean;
	sortKey: number;
	inputRef: React.RefObject<HTMLInputElement | null>;
	onHoverCard: (index: number | null) => void;
	onDragStart: (index: number) => void;
	onDragEnd: () => void;
	onDragEnter: (index: number) => void;
	onDragLeave: () => void;
	onDragSort: (from: number, to: number) => void;
	onRemove: (index: number) => void;
	onDrop: (e: React.DragEvent) => void;
	onDragOverToggle: (v: boolean) => void;
	onLibraryClick: () => void;
}

export function PhotoWall({
	fileList,
	canAdd,
	canSort,
	disabled,
	dragIndex,
	hoverIndex,
	hoveredCard,
	dragOver,
	sortKey,
	inputRef,
	onHoverCard,
	onDragStart,
	onDragEnd,
	onDragEnter,
	onDragLeave,
	onDragSort,
	onRemove,
	onDrop,
	onDragOverToggle,
	onLibraryClick,
}: PhotoWallProps) {
	return (
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
						onMouseEnter={() => onHoverCard(index)}
						onMouseLeave={() => onHoverCard(null)}
						draggable={canSort}
						onDragStart={
							canSort
								? (e) => {
										onDragStart(index);
										e.dataTransfer.setData("text/plain", String(index));
										e.dataTransfer.effectAllowed = "move";
									}
								: undefined
						}
						onDragEnd={() => onDragEnd()}
						onDragEnter={canSort ? () => onDragEnter(index) : undefined}
						onDragLeave={canSort ? () => onDragLeave() : undefined}
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
										const from = Number(e.dataTransfer.getData("text/plain"));
										if (from !== index && !Number.isNaN(from)) {
											onDragSort(from, index);
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
									onRemove(index);
								}}
							/>
						</div>
					</div>
				))}
			</Image.PreviewGroup>

			{canAdd && !disabled && (
				<div
					onDragOver={(e) => {
						e.preventDefault();
						e.dataTransfer.dropEffect = "copy";
					}}
					onDragEnter={(e) => {
						e.preventDefault();
						onDragOverToggle(true);
					}}
					onDragLeave={(e) => {
						e.preventDefault();
						onDragOverToggle(false);
					}}
					onDrop={onDrop}
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
					<div
						onClick={(e) => {
							e.stopPropagation();
							onLibraryClick();
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
	);
}
