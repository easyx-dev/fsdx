/**
 * 权限选择器：表格形式，支持分组通配符
 * 选择分组时自动写入 group:* 通配符，选择单个权限时写入具体权限码
 */

import { ProTable } from "@fsdx/ui-spa/pro-table";
import { Checkbox } from "antd";
import type { CheckboxChangeEvent } from "antd/es/checkbox";
import type { ColumnsType } from "antd/es/table";
import { useMemo } from "react";
import {
	PERMISSIONS_BY_GROUP,
	type PermissionDef,
} from "#/permissions/permissions";

interface GroupRow {
	key: string;
	group: string;
	permissions: PermissionDef[];
	isGroupSelected: boolean;
	selectedIndividuals: PermissionDef[];
}

interface PermissionSelectorProps {
	value?: string[];
	onChange?: (value: string[]) => void;
}

/** 构建分组通配符 */
function wildcard(group: string) {
	return `${group}:*`;
}

/**
 * 权限选择器组件，嵌入 antd Form.Item 使用
 * 表格左侧为分组（可全选），右侧为权限码列表（可单选）
 */
export function PermissionSelector({
	value = [],
	onChange,
}: PermissionSelectorProps) {
	const groupData = useMemo<GroupRow[]>(() => {
		return Object.entries(PERMISSIONS_BY_GROUP).map(([group, perms]) => ({
			key: group,
			group,
			permissions: perms,
			isGroupSelected: value.includes(wildcard(group)),
			selectedIndividuals: perms.filter((p) => value.includes(p.code)),
		}));
	}, [value]);

	/** 切换分组全选 */
	const handleGroupToggle = (group: string, checked: boolean) => {
		const newValue = value.filter((v) => !v.startsWith(`${group}:`));
		if (checked) {
			newValue.push(wildcard(group));
		}
		onChange?.(newValue);
	};

	/** 处理单个权限码勾选变化 */
	const handleIndividualsChange = (group: string, checkedValues: string[]) => {
		const allCodes = PERMISSIONS_BY_GROUP[group].map((p) => p.code);
		// 移除当前分组的通配符和所有该组的权限码
		const newValue = value.filter((v) => !v.startsWith(`${group}:`));
		if (checkedValues.length === allCodes.length) {
			// 全部选中 → 使用分组通配符
			newValue.push(wildcard(group));
		} else {
			newValue.push(...checkedValues);
		}
		onChange?.(newValue);
	};

	const columns: ColumnsType<GroupRow> = [
		{
			title: "分组",
			dataIndex: "group",
			width: 120,
			render: (group, record) => (
				<Checkbox
					checked={record.isGroupSelected}
					indeterminate={
						!record.isGroupSelected && record.selectedIndividuals.length > 0
					}
					onChange={(e: CheckboxChangeEvent) =>
						handleGroupToggle(group as string, e.target.checked)
					}
				>
					{group}
				</Checkbox>
			),
		},
		{
			title: "权限码",
			dataIndex: "permissions",
			render: (perms: PermissionDef[], record) => {
				const allCodes = perms.map((p) => p.code);
				const checkedValues = record.isGroupSelected
					? allCodes
					: record.selectedIndividuals.map((p) => p.code);

				return (
					<Checkbox.Group
						value={checkedValues}
						onChange={(vals: string[]) =>
							handleIndividualsChange(record.group, vals)
						}
						options={perms.map((p) => ({
							label: `${p.name} (${p.code})`,
							value: p.code,
						}))}
					/>
				);
			},
		},
	];

	return (
		<ProTable<GroupRow>
			columns={columns}
			dataSource={groupData}
			pagination={false}
			size="small"
		/>
	);
}
