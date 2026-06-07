/**
 * 角色管理页面：CRUD + 权限分配
 */
import {
	DeleteOutlined,
	EditOutlined,
	PlusOutlined,
	SearchOutlined,
} from "@ant-design/icons";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
	Button,
	Form,
	Input,
	Modal,
	message,
	Popconfirm,
	Space,
	Table,
	Tag,
	Tree,
} from "antd";
import { useState } from "react";
import { z } from "zod";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import {
	PERMISSIONS,
	PERMISSIONS_BY_GROUP,
} from "#/lib/permissions/permissions";
import { permGuard } from "#/middleware/server-fn-auth";
import {
	type CreateRoleInput,
	createRole,
	deleteRole,
	getRoleList,
	type RoleRecord,
	type UpdateRoleInput,
	updateRole,
} from "#/server/role/role.server";

// ─── Server Functions ──────────────────────────────────────────────

const roleListSchema = z.object({ keyword: z.string().optional() });
const roleCreateSchema = z.object({
	name: z.string().min(1, "角色名称不能为空").max(50),
	slug: z.string().min(1, "角色标识不能为空").max(50),
	permissions: z.array(z.string()).default([]),
	description: z.string().optional(),
});
const roleUpdateSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1).max(50).optional(),
	slug: z.string().min(1).max(50).optional(),
	permissions: z.array(z.string()).optional(),
	description: z.string().optional(),
});
const idSchema = z.object({ id: z.string().min(1) });

const getRolesFn = createServerFn({ method: "GET" })
	.middleware([permGuard(PERMISSIONS.ROLE_VIEW)])
	.inputValidator(roleListSchema)
	.handler(async ({ data }) => getRoleList(data.keyword));

const createRoleFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.ROLE_CREATE)])
	.inputValidator(roleCreateSchema)
	.handler(async ({ data }) => createRole(data as CreateRoleInput));

const updateRoleFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.ROLE_EDIT)])
	.inputValidator(roleUpdateSchema)
	.handler(async ({ data }) => updateRole(data.id, data as UpdateRoleInput));

const deleteRoleFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.ROLE_DELETE)])
	.inputValidator(idSchema)
	.handler(async ({ data }) => deleteRole(data.id));

// ─── 权限树数据 ─────────────────────────────────────────────────────

const permissionTreeData = Object.entries(PERMISSIONS_BY_GROUP).map(
	([group, perms]) => ({
		title: group,
		key: group,
		children: perms.map((p) => ({
			title: `${p.name} (${p.code})`,
			key: p.code,
		})),
	}),
);

// ─── Route & Component ──────────────────────────────────────────────

export const Route = createFileRoute("/admin/_admin/roles/")({
	component: RolesPage,
	loader: async () => getRolesFn({ data: {} }),
});

function RolesPage() {
	const initialRoles = Route.useLoaderData();
	const [roles, setRoles] = useState<RoleRecord[]>(initialRoles);
	const [keyword, setKeyword] = useState("");
	const [modalOpen, setModalOpen] = useState(false);
	const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);
	const [saving, setSaving] = useState(false);
	const [form] = Form.useForm();

	/** 刷新列表 */
	const refresh = async () => {
		const data = await getRolesFn({ data: { keyword: keyword || undefined } });
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
	const handleEdit = (record: RoleRecord) => {
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
				await updateRoleFn({
					data: { id: editingRole.id, ...values },
				});
				message.success("角色已更新");
			} else {
				await createRoleFn({ data: values });
				message.success("角色已创建");
			}
			setModalOpen(false);
			await refresh();
		} catch (err) {
			if (err instanceof Error && err.message) {
				message.error(err.message);
			}
		} finally {
			setSaving(false);
		}
	};

	/** 删除角色 */
	const handleDelete = async (id: string) => {
		try {
			await deleteRoleFn({ data: { id } });
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
			render: (perms: string[]) => (
				<div className="flex flex-wrap gap-1">
					{perms.length === 0 ? (
						<span className="text-muted-foreground text-xs">无权限</span>
					) : (
						perms.slice(0, 5).map((p) => (
							<Tag key={p} color="blue" className="text-xs">
								{p}
							</Tag>
						))
					)}
					{perms.length > 5 && (
						<Tag className="text-xs">+{perms.length - 5}</Tag>
					)}
				</div>
			),
		},
		{
			title: "描述",
			dataIndex: "description",
			key: "description",
			ellipsis: true,
			render: (v: string | null) => v ?? "—",
		},
		{
			title: "操作",
			key: "actions",
			width: 120,
			render: (_: unknown, record: RoleRecord) => (
				<Space size={4}>
					<Button
						type="link"
						size="small"
						icon={<EditOutlined />}
						onClick={() => handleEdit(record)}
					>
						编辑
					</Button>
					<Popconfirm
						title="确定删除此角色？"
						onConfirm={() => handleDelete(record.id)}
					>
						<Button type="link" size="small" danger icon={<DeleteOutlined />}>
							删除
						</Button>
					</Popconfirm>
				</Space>
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
					onChange={(e) => setKeyword(e.target.value)}
					onPressEnter={handleSearch}
					allowClear
					style={{ width: 260 }}
					prefix={<SearchOutlined />}
				/>
				<Button onClick={handleSearch}>搜索</Button>
			</div>

			<Table
				dataSource={roles}
				columns={columns}
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
				destroyOnClose
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
					<Form.Item
						name="permissions"
						label="权限分配"
						rules={[
							{
								required: true,
								message: "请选择至少一个权限",
								type: "array",
								min: 1,
							},
						]}
					>
						<Tree
							checkable
							treeData={permissionTreeData}
							style={{ maxHeight: 320, overflow: "auto" }}
						/>
					</Form.Item>
				</Form>
			</Modal>
		</AdminPageContent>
	);
}
