/**
 * 角色管理页面：CRUD + 权限分配
 */
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { AdminPageContent } from "@fsdx/ui-spa/admin-page-content";
import { PermissionTags } from "@fsdx/ui-spa/permission-tags";
import { ProTable } from "@fsdx/ui-spa/pro-table";
import { TableOperate } from "@fsdx/ui-spa/table-operate";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Form, Input, Modal } from "antd";
import type { ChangeEvent } from "react";
import { useState } from "react";
import { PermissionSelector } from "#/components/admin/PermissionSelector";
import { message } from "#/components/antd-static";
import { PERMISSION_META } from "#/constants/permissions/permissions";
import type { AdminRoleRecord } from "#/services/admin-role/admin-role.server";
import {
	createAdminRoleSFn,
	deleteAdminRoleSFn,
	getAdminRolesSFn,
	updateAdminRoleSFn,
} from "./-mods/admin-roles.functions";

// ─── Route & Component ──────────────────────────────────────────────

export const Route = createFileRoute("/admin/_admin/admin-roles/")({
	component: AdminRolesPage,
	loader: async () => getAdminRolesSFn({ data: {} }),
});

function AdminRolesPage() {
	const initialRoles = Route.useLoaderData();
	const [roles, setRoles] = useState<AdminRoleRecord[]>(initialRoles);
	const [keyword, setKeyword] = useState("");
	const [modalOpen, setModalOpen] = useState(false);
	const [editingRole, setEditingRole] = useState<AdminRoleRecord | null>(null);
	const [saving, setSaving] = useState(false);
	const [form] = Form.useForm();

	/** 刷新列表 */
	const refresh = async () => {
		const data = await getAdminRolesSFn({
			data: { keyword: keyword || undefined },
		});
		setRoles(data);
	};

	/** 搜索 */
	const handleSearch = async () => {
		await refresh();
	};

	/** 打开新建弹窗 */
	const handleCreate = () => {
		setEditingRole(null);
		form.resetFields();
		form.setFieldsValue({ permissions: [] });
		setModalOpen(true);
	};

	/** 打开编辑弹窗 */
	const handleEdit = (record: AdminRoleRecord) => {
		setEditingRole(record);
		form.setFieldsValue({
			name: record.name,
			slug: record.slug,
			description: record.description ?? "",
			permissions: record.permissions ?? [],
		});
		setModalOpen(true);
	};

	/** 提交表单 */
	const handleSubmit = async () => {
		try {
			const values = await form.validateFields();
			setSaving(true);
			if (editingRole) {
				await updateAdminRoleSFn({
					data: { id: editingRole.id, ...values },
				});
				message.success("角色已更新");
			} else {
				await createAdminRoleSFn({ data: values });
				message.success("角色已创建");
			}
			setModalOpen(false);
			await refresh();
		} catch (err) {
			if (err instanceof Error && err.message) {
				message.error(err.message);
			} else {
				message.error("操作失败");
			}
		} finally {
			setSaving(false);
		}
	};

	/** 删除角色 */
	const handleDelete = async (id: string) => {
		try {
			await deleteAdminRoleSFn({ data: { id } });
			message.success("角色已删除");
			await refresh();
		} catch (err) {
			message.error(err instanceof Error ? err.message : "删除失败");
		}
	};

	const columns = [
		{
			title: "角色名称",
			dataIndex: "name",
			key: "name",
			width: 160,
		},
		{
			title: "标识",
			dataIndex: "slug",
			key: "slug",
			width: 140,
			render: (v: string) => <code className="text-xs">{v}</code>,
		},
		{
			title: "权限",
			dataIndex: "permissions",
			key: "permissions",
			width: 280,
			render: (perms: string[]) => (
				<PermissionTags permissions={perms} meta={PERMISSION_META} />
			),
		},
		{
			title: "描述",
			dataIndex: "description",
			key: "description",
			ellipsis: true,
			width: 140,
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
			render: (_: unknown, record: AdminRoleRecord) => (
				<TableOperate>
					<TableOperate.Edit onClick={() => handleEdit(record)} />
					<TableOperate.Delete
						recordName="此角色"
						onConfirm={() => handleDelete(record.id)}
					/>
				</TableOperate>
			),
		},
	];

	return (
		<AdminPageContent
			title="角色管理"
			description="管理系统角色及其权限分配"
			extra={
				<Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
					新建角色
				</Button>
			}
		>
			{/* 搜索栏 */}
			<div className="mb-4 flex items-center gap-2">
				<Input
					placeholder="搜索角色名称或标识..."
					value={keyword}
					onChange={(e: ChangeEvent<HTMLInputElement>) =>
						setKeyword(e.target.value)
					}
					onPressEnter={handleSearch}
					allowClear
					style={{ width: 260 }}
					prefix={<SearchOutlined />}
				/>
				<Button onClick={handleSearch}>搜索</Button>
			</div>

			<ProTable
				dataSource={roles}
				columns={columns}
				scroll={{ x: 1280 }}
				rowKey="id"
				locale={{ emptyText: "暂无角色" }}
			/>

			{/* 创建/编辑弹窗 */}
			<Modal
				title={editingRole ? "编辑角色" : "新建角色"}
				open={modalOpen}
				onCancel={() => setModalOpen(false)}
				onOk={handleSubmit}
				confirmLoading={saving}
				width={600}
				destroyOnHidden
			>
				<Form form={form} layout="vertical" className="mt-4">
					<Form.Item
						name="name"
						label="角色名称"
						rules={[{ required: true, message: "请输入角色名称" }]}
					>
						<Input placeholder="如：编辑人员" />
					</Form.Item>
					<Form.Item
						name="slug"
						label="角色标识"
						rules={[{ required: true, message: "请输入角色标识" }]}
					>
						<Input placeholder="如：editor" disabled={!!editingRole} />
					</Form.Item>
					<Form.Item name="description" label="描述">
						<Input.TextArea rows={2} placeholder="角色描述（可选）" />
					</Form.Item>
					<Form.Item name="permissions" label="权限分配">
						<PermissionSelector />
					</Form.Item>
				</Form>
			</Modal>
		</AdminPageContent>
	);
}
