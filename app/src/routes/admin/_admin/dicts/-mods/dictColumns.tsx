/**
 * 字典条目表格列定义
 */
import { TableOperate } from "@fsdx/ui-spa/table";
import { InputNumber, Switch, Tag } from "antd";
import { EditorTypes, FieldTranslationDrawer } from "#/components/admin";
import type { DictItemRecord } from "#/services/dict/dict.server";
import { isPresetDict } from "./dictUtils";

/** 字典条目可翻译字段定义 */
const DICT_ITEM_TRANSLATABLE_FIELDS = [
	{ name: "label", label: "标签", valueType: "input" as const },
];

interface DictItemColumnsHandlers {
	onInlineUpdate: (
		id: string,
		params: { sortOrder?: number; status?: string },
	) => void;
	onEdit: (record: DictItemRecord) => void;
	onDelete: (id: string) => void;
}

/** 字典条目表格列（排序/状态行内编辑，预置字典条目禁止删除） */
export function dictItemColumns(handlers: DictItemColumnsHandlers) {
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
			width: 120,
			render: (val: number, record: DictItemRecord) => (
				<InputNumber
					size="small"
					className="w-full"
					min={0}
					value={val}
					onChange={(v: number | null) => {
						if (v != null && v !== val) {
							handlers.onInlineUpdate(record.id, { sortOrder: v });
						}
					}}
				/>
			),
		},
		{
			title: "状态",
			dataIndex: "status",
			key: "status",
			width: 80,
			render: (val: string, record: DictItemRecord) => (
				<Switch
					size="small"
					checked={val === "active"}
					checkedChildren="启用"
					unCheckedChildren="禁用"
					onChange={(checked: boolean) => {
						handlers.onInlineUpdate(record.id, {
							status: checked ? "active" : "disabled",
						});
					}}
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
			width: 185,
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
			render: (_: unknown, record: DictItemRecord) => (
				<TableOperate>
					<TableOperate.Edit onClick={() => handlers.onEdit(record)} />
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
							onConfirm={() => handlers.onDelete(record.id)}
						/>
					)}
				</TableOperate>
			),
		},
	];
}
