/**
 * 管理员管理页面：CRUD + 角色分配 + 密码重置
 */
import {
	DeleteOutlined,
	EditOutlined,
	KeyOutlined,
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
	Select,
	Space,
	Tag,
} from "antd";
import { useState } from "react";
import { z } from "zod";
import { AutofillBlocker } from "#/components/AutofillBlocker";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import { DictSelect } from "#/components/admin/DictSelect";
import { DictTag } from "#/components/admin/DictTag";
import { ProTable } from "#/components/admin/ProTable";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import type { SortOrder } from "#/lib/query/query-utils";
import { adminPermGuard } from "#/middleware/admin-auth";
import {
	type AdminUserListItem,
	type AdminUserListParams,
	type CreateAdminUserInput,
	createAdminUser,
	deleteAdminUser,
	getAdminUser,
	getAdminUserList,
	resetAdminPassword,
	type UpdateAdminUserInput,
	updateAdminUser,
} from "#/server/admin-user/admin-user.server";
import { logOperation } from "#/server/operation-log/operation-log.server";
import { getRoleList as getRoleListService } from "#/server/role/role.server";

// ─── Server Functions ──────────────────────────────────────────────

const listSchema = z.object({
	page: z.number().optional(),
	pageSize: z.number().optional(),
	keyword: z.string().optional(),
	sortField: z.string().optional(),
	sortOrder: z.enum(["ascend", "descend"]).optional(),
});

const getRolesForSelect = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.ADMIN_VIEW)])
	.handler(async () => getRoleListService());
const createSchema = z.object({
	username: z.string().min(1).max(50),
	email: z.string().email().max(255),
	password: z.string().min(6).max(100),
	roleId: z.string().min(1),
});
const updateSchema = z.object({
	id: z.string().min(1),
	username: z.string().min(1).max(50).optional(),
	email: z.string().email().max(255).optional(),
	roleId: z.string().optional(),
	status: z.string().optional(),
});
const idSchema = z.object({ id: z.string().min(1) });
const resetPwdSchema = z.object({
	id: z.string().min(1),
	password: z.string().min(6).max(100),
});

const getListFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.ADMIN_VIEW)])
	.inputValidator(listSchema)
	.handler(async ({ data }) => getAdminUserList(data as AdminUserListParams));

const createFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.ADMIN_CREATE)])
	.inputValidator(createSchema)
	.handler(async ({ data, context }) => {
		const record = await createAdminUser(data as CreateAdminUserInput);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "admin",
			action: "create",
			targetType: "admin_user",
			targetId: record.id,
			targetName: record.username,
		});
		return record;
	});

const updateFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.ADMIN_EDIT)])
	.inputValidator(updateSchema)
	.handler(async ({ data, context }) => {
		const result = await updateAdminUser(data.id, data as UpdateAdminUserInput);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "admin",
			action: "update",
			targetType: "admin_user",
			targetId: data.id,
			targetName: result?.username || data.id,
		});
		return result;
	});

const deleteFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.ADMIN_DELETE)])
	.inputValidator(idSchema)
	.handler(async ({ data, context }) => {
		const existing = await getAdminUser(data.id);
		const result = await deleteAdminUser(data.id, context.user.id);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "admin",
			action: "delete",
			targetType: "admin_user",
			targetId: data.id,
			targetName: existing?.username || data.id,
		});
		return result;
	});

const resetPwdFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.ADMIN_EDIT)])
	.inputValidator(resetPwdSchema)
	.handler(async ({ data, context }) => {
		const existing = await getAdminUser(data.id);
		const result = await resetAdminPassword(data.id, data.password);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "admin",
			action: "reset_pwd",
			targetType: "admin_user",
			targetId: data.id,
			targetName: existing?.username || data.id,
		});
		return result;
	});

// ─── Route & Component ──────────────────────────────────────────────

export const Route = createFileRoute("/admin/_admin/users/admins/")({
	component: AdminsPage,
	loader: async () => {
		const [result, roles] = await Promise.all([
			getListFn({ data: { page: 1, pageSize: 20 } }),
			getRolesForSelect(),
		]);
		return { result, roles };
	},
});

function AdminsPage() {
	const initial = Route.useLoaderData();
	const [data, setData] = useState(initial.result);
	const [roles] = useState<RoleRecord[]>(initial.roles);
	const [keyword, setKeyword] = useState("");
	const [page, setPage] = useState(1);
	const [sortField, setSortField] = useState<string | undefined>();
	const [sortOrder, setSortOrder] = useState<SortOrder | undefined>();
	const [modalOpen, setModalOpen] = useState(false);
	const [pwdModalOpen, setPwdModalOpen] = useState(false);
	const [editingUser, setEditingUser] = useState<AdminUserListItem | null>(
		null,
	);
	const [saving, setSaving] = useState(false);
	const [form] = Form.useForm();
	const [pwdForm] = Form.useForm();

	const refresh = async (p = page) => {
		const result = await getListFn({
			data: {
				page: p,
				pageSize: 20,
				keyword: keyword || undefined,
				sortField,
				sortOrder,
			},
		});
		setData(result);
		setPage(p);
	};

	const handleSearch = () => refresh(1);

	const handleTableChange = async (
		_pagination: unknown,
		_filters: unknown,
		sorter: unknown,
	) => {
		const s = sorter as { field?: string; order?: string };
		setSortField(s.field);
		setSortOrder(s.order as SortOrder);
		await refresh(1);
	};

	const handleCreate = () => {
		setEditingUser(null);
		form.resetFields();
		setModalOpen(true);
	};

	const handleEdit = (record: AdminUserListItem) => {
		setEditingUser(record);
		form.setFieldsValue({
			username: record.username,
			email: record.email,
			roleId: record.roleId,
			status: record.status,
		});
		setModalOpen(true);
	};

	const handleSubmit = async () => {
		try {
			const values = await form.validateFields();
			setSaving(true);
			if (editingUser) {
				await updateFn({ data: { id: editingUser.id, ...values } });
				message.success("管理员信息已更新");
			} else {
				await createFn({ data: values });
				message.success("管理员已创建");
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

	const handleDelete = async (id: string) => {
		try {
			await deleteFn({ data: { id } });
			message.success("管理员已删除");
			await refresh();
		} catch (err) {
			message.error(err instanceof Error ? err.message : "删除失败");
		}
	};

	const handleResetPwd = (record: AdminUserListItem) => {
		setEditingUser(record);
		pwdForm.resetFields();
		setPwdModalOpen(true);
	};

	const handlePwdSubmit = async () => {
		try {
			const values = await pwdForm.validateFields();
			await resetPwdFn({
				data: { id: editingUser!.id, password: values.password },
			});
			message.success("密码已重置");
			setPwdModalOpen(false);
		} catch (err) {
			if (err instanceof Error && err.message) {
				message.error(err.message);
			}
		}
	};

	const columns = [
		{
			title: "用户名",
			dataIndex: "username",
			key: "username",
			width: 140,
			sorter: true,
		},
		{
			title: "邮箱",
			dataIndex: "email",
			key: "email",
			width: 200,
			ellipsis: true,
			sorter: true,
		},
		{
			title: "角色",
			dataIndex: "roleName",
			key: "roleName",
			width: 120,
			render: (_: unknown, record: AdminUserListItem) => (
				<span>
					{record.isRoot ? (
						<Tag color="red">超级管理员</Tag>
					) : (
						(record.roleName ?? "—")
					)}
				</span>
			),
		},
		{
			title: "状态",
			dataIndex: "status",
			key: "status",
			width: 90,
			render: (v: string) => <DictTag dictSlug="user_status" value={v} />,
		},
		{
			title: "最后登录",
			dataIndex: "lastLoginAt",
			key: "lastLoginAt",
			width: 185,
			valueType: "dateTime",
			sorter: true,
		},
		{
			title: "创建时间",
			dataIndex: "createdAt",
			key: "createdAt",
			width: 185,
			valueType: "dateTime",
			sorter: true,
		},
		{
			title: "更新时间",
			dataIndex: "updatedAt",
			key: "updatedAt",
			width: 185,
			valueType: "dateTime",
			sorter: true,
		},
		{
			title: "操作",
			key: "actions",
			render: (_: unknown, record: AdminUserListItem) => (
				<Space size={4}>
					<Button
						type="link"
						size="small"
						icon={<EditOutlined />}
						onClick={() => handleEdit(record)}
					>
						编辑
					</Button>
					<Button
						type="link"
						size="small"
						icon={<KeyOutlined />}
						onClick={() => handleResetPwd(record)}
					>
						重置密码
					</Button>
					{!record.isRoot && (
						<Popconfirm
							title="确定删除此管理员？"
							onConfirm={() => handleDelete(record.id)}
						>
							<Button
								type="link"
								size="small"
								danger
								icon={<DeleteOutlined />}
							/>
						</Popconfirm>
					)}
				</Space>
			),
		},
	];

	return (
		<AdminPageContent
			title="管理员管理"
			description="管理系统管理员账号与角色分配"
			extra={
				<Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
					新建管理员
				</Button>
			}
		>
			<div className="mb-4 flex items-center gap-2">
				<Input
					placeholder="搜索用户名或邮箱..."
					value={keyword}
					onChange={(e) => setKeyword(e.target.value)}
					onPressEnter={handleSearch}
					allowClear
					style={{ width: 260 }}
					prefix={<SearchOutlined />}
				/>
				<Button onClick={handleSearch}>搜索</Button>
			</div>

			<ProTable
				dataSource={data.records}
				columns={columns}
				rowKey="id"
				locale={{ emptyText: "暂无管理员" }}
				pagination={{
					total: data.total,
					current: page,
					pageSize: 20,
					showSizeChanger: false,
					showTotal: (total) => `共 ${total} 条`,
					onChange: (p) => refresh(p),
				}}
				onChange={handleTableChange}
			/>

			{/* 创建/编辑弹窗 */}
			<Modal
				title={editingUser ? "编辑管理员" : "新建管理员"}
				open={modalOpen}
				onCancel={() => setModalOpen(false)}
				onOk={handleSubmit}
				confirmLoading={saving}
				width={520}
				destroyOnHidden
			>
				<Form form={form} layout="vertical" className="mt-4">
					<AutofillBlocker />
					<Form.Item
						name="username"
						label="用户名"
						rules={[{ required: true, message: "请输入用户名" }]}
					>
						<Input placeholder="用户名" />
					</Form.Item>
					<Form.Item
						name="email"
						label="邮箱"
						rules={[
							{ required: true, message: "请输入邮箱" },
							{ type: "email", message: "请输入有效的邮箱地址" },
						]}
					>
						<Input placeholder="admin@example.com" />
					</Form.Item>
					{!editingUser && (
						<Form.Item
							name="password"
							label="密码"
							rules={[
								{ required: true, message: "请输入密码" },
								{ min: 6, message: "密码至少 6 个字符" },
							]}
						>
							<Input.Password placeholder="至少 6 位" />
						</Form.Item>
					)}
					<Form.Item
						name="roleId"
						label="角色"
						rules={[{ required: true, message: "请选择角色" }]}
					>
						<Select
							placeholder="选择角色"
							options={roles.map((r) => ({
								label: r.name,
								value: r.id,
							}))}
						/>
					</Form.Item>
					{editingUser && !editingUser.isRoot && (
						<Form.Item name="status" label="状态">
							<DictSelect dictSlug="user_status" />
						</Form.Item>
					)}
				</Form>
			</Modal>

			{/* 重置密码弹窗 */}
			<Modal
				title={`重置密码 — ${editingUser?.username}`}
				open={pwdModalOpen}
				onCancel={() => setPwdModalOpen(false)}
				onOk={handlePwdSubmit}
				width={400}
				destroyOnHidden
			>
				<Form form={pwdForm} layout="vertical" className="mt-4">
					<AutofillBlocker />
					<Form.Item
						name="password"
						label="新密码"
						rules={[
							{ required: true, message: "请输入新密码" },
							{ min: 6, message: "密码至少 6 个字符" },
						]}
					>
						<Input.Password placeholder="至少 6 位" />
					</Form.Item>
				</Form>
			</Modal>
		</AdminPageContent>
	);
}

import type { RoleRecord } from "#/server/role/role.server";
