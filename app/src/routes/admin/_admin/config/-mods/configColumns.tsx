/**
 * 系统配置表格列定义
 */
import { TableOperate } from "@fsdx/ui-spa/table";
import {
	EditorTypes,
	FieldTranslationDrawer,
	type TranslatableField,
} from "#/components/admin";
import type { ConfigRecord } from "#/services/config/config.server";

/** 系统配置可翻译字段定义 */
const CONFIG_TRANSLATABLE_FIELDS: TranslatableField[] = [
	{ name: "value", label: "配置值", valueType: "text" },
];

interface ConfigColumnsOptions {
	onEdit: (record: ConfigRecord) => void;
	onDelete: (id: string) => void;
}

/** 系统配置表格列：客户端可见项支持字段翻译 */
export function configColumns(options: ConfigColumnsOptions) {
	return [
		{
			title: "配置键",
			dataIndex: "key",
			key: "key",
			width: 240,
			render: (key: string) => (
				<code className="text-xs text-primary">{key}</code>
			),
		},
		{
			title: "配置值",
			dataIndex: "value",
			key: "value",
			width: 180,
			ellipsis: true,
		},
		{
			title: "值类型",
			dataIndex: "valueType",
			key: "valueType",
			width: 130,
			render: (val: string | null) => (
				<EditorTypes.Preview valueType={val} fallback="Text" />
			),
		},
		{
			title: "分组",
			dataIndex: "groupName",
			key: "groupName",
			width: 120,
			render: (val: string | null) => val || "未分组",
		},
		{
			title: "客户端可见",
			dataIndex: "clientVisible",
			key: "clientVisible",
			width: 100,
			render: (val: boolean) => (val ? "是" : "否"),
		},
		{
			title: "描述",
			dataIndex: "description",
			key: "description",
			ellipsis: true,
			width: 180,
			render: (desc: string | null) => desc || "—",
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
			render: (_: unknown, record: ConfigRecord) => {
				const showTranslation = record.clientVisible === true;
				return (
					<TableOperate>
						<TableOperate.Edit onClick={() => options.onEdit(record)} />
						<TableOperate.Delete
							recordName="该配置"
							onConfirm={() => options.onDelete(record.id)}
						/>
						{showTranslation && (
							<TableOperate.Custom>
								<FieldTranslationDrawer
									entityType="system_config"
									entityId={record.id}
									fields={CONFIG_TRANSLATABLE_FIELDS}
									originalValues={{ value: record.value }}
								/>
							</TableOperate.Custom>
						)}
					</TableOperate>
				);
			},
		},
	];
}
