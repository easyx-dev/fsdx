/**
 * 管理端角色表格列定义
 * 权限标签只读展示；时间列走 ProTable valueType（列表统一到分钟）
 */
import { PermissionTags } from "@fsdx/ui-spa/permission-tags";
import { TableOperate } from "@fsdx/ui-spa/table";
import { ADMIN_PERMISSION_META } from "#/permissions/admin-permissions";
import type { AdminRoleRecord } from "#/services/admin-role/admin-role.server";
import type { SortProps } from "#/utils/use-list-query";

interface AdminRoleColumnsOptions {
	/** 列排序属性生成器（来自 useListQuery.sortProps） */
	sortProps: (field: string) => SortProps;
	/** 打开编辑弹窗 */
	onEdit: (record: AdminRoleRecord) => void;
	/** 删除 */
	onDelete: (record: AdminRoleRecord) => Promise<void>;
	/** 权限开关：无权限的操作置灰并提示（服务端 guard 仍为唯一权威） */
	permissions: {
		edit: boolean;
		delete: boolean;
	};
}

const NO_EDIT_PERMISSION = "无「编辑角色」权限";
const NO_DELETE_PERMISSION = "无「删除角色」权限";

/** 角色表格列 */
export function adminRoleColumns(options: AdminRoleColumnsOptions) {
	const { permissions } = options;
	return [
		{
			title: "角色名称",
			dataIndex: "name",
			key: "name",
			width: 160,
			...options.sortProps("name"),
		},
		{
			title: "标识",
			dataIndex: "slug",
			key: "slug",
			width: 160,
			...options.sortProps("slug"),
			render: (v: string) => <code className="text-xs">{v}</code>,
		},
		{
			title: "权限",
			dataIndex: "permissions",
			key: "permissions",
			width: 280,
			render: (perms: string[]) => (
				<PermissionTags permissions={perms} meta={ADMIN_PERMISSION_META} />
			),
		},
		{
			title: "描述",
			dataIndex: "description",
			key: "description",
			ellipsis: true,
			width: 200,
		},
		{
			title: "创建时间",
			dataIndex: "createdAt",
			key: "createdAt",
			width: 150,
			...options.sortProps("createdAt"),
			valueType: "dateTimeMinute",
		},
		{
			title: "更新时间",
			dataIndex: "updatedAt",
			key: "updatedAt",
			width: 150,
			...options.sortProps("updatedAt"),
			valueType: "dateTimeMinute",
		},
		{
			title: "操作",
			key: "actions",
			fixed: "right" as const,
			// 操作列固定右侧必须显式声明宽度（2 项操作 160）
			width: 160,
			render: (_: unknown, record: AdminRoleRecord) => (
				<TableOperate>
					<TableOperate.Edit
						onClick={() => options.onEdit(record)}
						disabled={!permissions.edit}
						disabledReason={NO_EDIT_PERMISSION}
					/>
					<TableOperate.Delete
						recordName="此角色"
						disabled={!permissions.delete}
						disabledReason={NO_DELETE_PERMISSION}
						onConfirm={() => options.onDelete(record)}
					/>
				</TableOperate>
			),
		},
	];
}
