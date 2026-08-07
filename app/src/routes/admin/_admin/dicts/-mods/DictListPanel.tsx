/**
 * 字典类型侧边列表：选择、新建、编辑、删除
 */
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Card, Popconfirm, Space } from "antd";
import type { MouseEvent } from "react";
import type { DictRecord } from "#/services/dict/dict.server";
import { isPresetDict } from "./dictUtils";

interface DictListPanelProps {
	dicts: DictRecord[];
	selectedSlug: string | null;
	onSelect: (slug: string) => void;
	onCreate: () => void;
	onEdit: (record: DictRecord) => void;
	onDelete: (record: DictRecord) => void;
}

/** 字典类型侧边栏：点击选择，行内编辑/删除预置保护 */
export function DictListPanel({
	dicts,
	selectedSlug,
	onSelect,
	onCreate,
	onEdit,
	onDelete,
}: DictListPanelProps) {
	return (
		<Card
			size="small"
			classNames={{
				root: "flex-[0_0_200px]",
			}}
			title="字典类型"
			extra={
				<Button
					type="primary"
					size="small"
					icon={<PlusOutlined />}
					onClick={onCreate}
				>
					新建字典
				</Button>
			}
			styles={{ body: { padding: 0 } }}
		>
			{dicts.length === 0 ? (
				<div className="p-4 text-center text-muted-foreground text-sm">
					暂无字典
				</div>
			) : (
				<div className="divide-y divide-border">
					{dicts.map((record) => {
						const isActive = selectedSlug === record.slug;
						return (
							<div
								key={record.id}
								className={`flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors hover:bg-accent ${
									isActive ? "bg-primary-bg" : ""
								}`}
								onClick={() => onSelect(record.slug)}
							>
								<div className="flex items-center gap-2 min-w-0">
									{isActive && (
										<span className="w-1 h-6 rounded-full bg-primary flex-shrink-0" />
									)}
									<div className="min-w-0">
										<div
											className={
												isActive
													? "font-semibold text-primary truncate"
													: "truncate"
											}
										>
											{record.name}
										</div>
										<div className="text-xs text-muted-foreground truncate">
											{record.slug}
										</div>
									</div>
								</div>
								<Space size={4} className="flex-shrink-0 ml-2">
									<Button
										type="link"
										size="small"
										icon={<EditOutlined />}
										onClick={(e: MouseEvent<HTMLElement>) => {
											e.stopPropagation();
											onEdit(record);
										}}
									/>
									{!isPresetDict(record.slug) && (
										<Popconfirm
											title="确定删除该字典及所有条目？"
											onConfirm={(e?: MouseEvent<HTMLElement>) => {
												e?.stopPropagation();
												onDelete(record);
											}}
											onCancel={(e?: MouseEvent<HTMLElement>) =>
												e?.stopPropagation()
											}
										>
											<Button
												type="link"
												size="small"
												danger
												icon={<DeleteOutlined />}
												onClick={(e: MouseEvent<HTMLElement>) =>
													e.stopPropagation()
												}
											/>
										</Popconfirm>
									)}
								</Space>
							</div>
						);
					})}
				</div>
			)}
		</Card>
	);
}
