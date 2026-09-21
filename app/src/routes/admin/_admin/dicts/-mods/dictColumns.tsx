/**
 * 字典条目表格列定义
 * 排序权重 / 启用状态为通用态（单元格内联编辑）；时间列走 ProTable valueType；预置字典条目禁用删除
 */
import {
	PublishSwitchCell,
	SortOrderCell,
	TableOperate,
} from "@fsdx/ui-spa/table";
import { Tag } from "antd";
import { EditorTypes, FieldTranslationDrawer } from "#/components/admin";
import type { DictItemRecord } from "#/shared-services/dict/dict.server";
import { isPresetDict } from "./dict.utils";

/** 字典条目可翻译字段定义 */
const DICT_ITEM_TRANSLATABLE_FIELDS = [
	{ name: "label", label: "标签", valueType: "input" as const },
];

interface DictItemColumnsHandlers {
	/** 列排序属性生成器（来自 useListQuery.sortProps） */
	sortProps: (field: string) => {
		sorter: true;
		sortOrder?: "ascend" | "descend";
	};
	/** 单元格内修改排序权重 */
	onChangeSortOrder: (record: DictItemRecord, next: number) => Promise<void>;
	/** 单元格内切换启用状态 */
	onToggleStatus: (record: DictItemRecord, next: boolean) => Promise<void>;
	/** 编辑条目 */
	onEdit: (record: DictItemRecord) => void;
	/** 删除条目 */
	onDelete: (record: DictItemRecord) => Promise<void>;
	/** 权限开关：无权限的操作置灰并提示（服务端 guard 仍为唯一权威） */
	permissions: {
		editItem: boolean;
		deleteItem: boolean;
	};
}

const NO_EDIT_PERMISSION = "无「编辑字典条目」权限";
const NO_DELETE_PERMISSION = "无「删除字典条目」权限";

/** 字典条目表格列（排序/状态行内编辑，预置字典条目禁止删除） */
export function dictItemColumns(handlers: DictItemColumnsHandlers) {
	const { permissions } = handlers;
	return [
		{ title: "标签", dataIndex: "label", key: "label", width: 120 },
		{
			title: "值",
			dataIndex: "value",
			key: "value",
			width: 180,
			render: (val: string) => <code className="text-xs">{val}</code>,
		},
		{
			title: "排序",
			dataIndex: "sortOrder",
			key: "sortOrder",
			width: 130,
			...handlers.sortProps("sortOrder"),
			render: (_: unknown, record: DictItemRecord) => (
				<SortOrderCell
					value={record.sortOrder}
					onSubmit={(next) => handlers.onChangeSortOrder(record, next)}
					disabled={!permissions.editItem}
					disabledReason={NO_EDIT_PERMISSION}
				/>
			),
		},
		{
			title: "状态",
			dataIndex: "status",
			key: "status",
			width: 120,
			render: (_: unknown, record: DictItemRecord) => (
				<PublishSwitchCell
					published={record.status === "active"}
					labels={{ on: "启用", off: "禁用" }}
					onToggle={(next) => handlers.onToggleStatus(record, next)}
					disabled={!permissions.editItem}
					disabledReason={NO_EDIT_PERMISSION}
				/>
			),
		},
		{
			title: "额外类型",
			dataIndex: "extraType",
			key: "extraType",
			width: 110,
			render: (val: string | null) => <EditorTypes.Preview valueType={val} />,
		},
		{
			title: "额外值",
			dataIndex: "extra",
			key: "extra",
			width: 120,
			ellipsis: true,
			render: (val: string | null) => val || "—",
		},
		{
			title: "颜色",
			dataIndex: "color",
			key: "color",
			width: 80,
			render: (val: string | null) =>
				val ? <Tag color={val}>{val}</Tag> : "—",
		},
		{
			title: "创建时间",
			dataIndex: "createdAt",
			key: "createdAt",
			width: 160,
			...handlers.sortProps("createdAt"),
			valueType: "dateTimeMinute",
		},
		{
			title: "更新时间",
			dataIndex: "updatedAt",
			key: "updatedAt",
			width: 160,
			...handlers.sortProps("updatedAt"),
			valueType: "dateTimeMinute",
		},
		{
			title: "操作",
			key: "actions",
			fixed: "right" as const,
			// 操作列固定右侧必须显式声明宽度（3 项 → 240）
			width: 240,
			render: (_: unknown, record: DictItemRecord) => (
				<TableOperate>
					<TableOperate.Edit
						onClick={() => handlers.onEdit(record)}
						disabled={!permissions.editItem}
						disabledReason={NO_EDIT_PERMISSION}
					/>
					<TableOperate.Custom>
						<FieldTranslationDrawer
							entityType="dict_item"
							entityId={record.id}
							fields={DICT_ITEM_TRANSLATABLE_FIELDS}
							originalValues={{ label: record.label ?? "" }}
						/>
					</TableOperate.Custom>
					{!isPresetDict(record.dictSlug) && (
						<TableOperate.Delete
							recordName="该条目"
							disabled={!permissions.deleteItem}
							disabledReason={NO_DELETE_PERMISSION}
							onConfirm={() => handlers.onDelete(record)}
						/>
					)}
				</TableOperate>
			),
		},
	];
}
