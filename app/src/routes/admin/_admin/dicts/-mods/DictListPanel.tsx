/**
 * 字典类型侧边列表：选择、编辑、删除
 * 新建入口统一放页面标题栏，避免与列表页主操作重复
 */
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { withDisabledReason } from "@fsdx/ui-spa/table";
import { Button, Card, Popconfirm, Space } from "antd";
import type { MouseEvent } from "react";
import type { DictRecord } from "#/shared-services/dict/dict.server";
import { isPresetDict } from "./dict.utils";

interface DictListPanelProps {
	dicts: DictRecord[];
	selectedSlug: string | null;
	onSelect: (slug: string) => void;
	onEdit: (record: DictRecord) => void;
	onDelete: (record: DictRecord) => void;
	/** 权限开关：无权限的操作置灰并提示（服务端 guard 仍为唯一权威） */
	permissions: {
		edit: boolean;
		delete: boolean;
	};
}

const NO_EDIT_PERMISSION = "无「编辑字典」权限";
const NO_DELETE_PERMISSION = "无「删除字典」权限";

/** 字典类型侧边栏：点击选择，行内编辑/删除预置保护 */
export function DictListPanel({
	dicts,
	selectedSlug,
	onSelect,
	onEdit,
	onDelete,
	permissions,
}: DictListPanelProps) {
	return (
		<Card
			size="small"
			classNames={{
				root: "flex-[0_0_200px]",
			}}
			title="字典类型"
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
						const canDelete = permissions.delete && !isPresetDict(record.slug);
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
									{withDisabledReason(
										<Button
											type="link"
											size="small"
											icon={<EditOutlined />}
											disabled={!permissions.edit}
											onClick={(e: MouseEvent<HTMLElement>) => {
												e.stopPropagation();
												onEdit(record);
											}}
										/>,
										!permissions.edit,
										NO_EDIT_PERMISSION,
									)}
									{!isPresetDict(record.slug) &&
										withDisabledReason(
											<Popconfirm
												title="确定删除该字典及所有条目？"
												disabled={!canDelete}
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
													disabled={!canDelete}
													onClick={(e: MouseEvent<HTMLElement>) =>
														e.stopPropagation()
													}
												/>
											</Popconfirm>,
											!canDelete,
											NO_DELETE_PERMISSION,
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
