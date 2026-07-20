/**
 * 客户端用户管理页面：CRUD + 状态管理 + 密码重置
 */
import { KeyOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Form, Input, Modal, message, Switch, Tag } from "antd";
import { useState } from "react";
import { AutofillBlocker } from "#/components/AutofillBlocker";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import { DictSelect } from "#/components/admin/DictSelect";
import { DictTag } from "#/components/admin/DictTag";
import { ProTable } from "#/components/admin/ProTable";
import { TableOperate } from "#/components/admin/TableOperate";
import type { SortOrder } from "#/lib/query/query-utils";
import {
	createSFn,
	deleteSFn,
	getListSFn,
	resetPwdSFn,
	updateSFn,
} from "./-mods/clients.functions";
import type { ClientUserRecord } from "./-mods/clients.server";

// ─── Route & Component ──────────────────────────────────────────────

export const Route = createFileRoute("/admin/_admin/users/clients/")({
	component: ClientsPage,
	loader: async () => getListSFn({ data: { page: 1, pageSize: 20 } }),
});

function ClientsPage() {
	const initial = Route.useLoaderData();
	const [data, setData] = useState(initial);
	const [keyword, setKeyword] = useState("");
	const [page, setPage] = useState(1);
	const [sortField, setSortField] = useState<string | undefined>();
	const [sortOrder, setSortOrder] = useState<SortOrder | undefined>();
	const [modalOpen, setModalOpen] = useState(false);
	const [pwdModalOpen, setPwdModalOpen] = useState(false);
	const [editingUser, setEditingUser] = useState<ClientUserRecord | null>(null);
	const [saving, setSaving] = useState(false);
	const [form] = Form.useForm();
	const [pwdForm] = Form.useForm();

	const refresh = async (p = page) => {
		const result = await getListSFn({
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

	const handleEdit = (record: ClientUserRecord) => {
		setEditingUser(record);
		form.setFieldsValue({
			username: record.username,
			email: record.email,
			status: record.status,
			emailVerified: record.emailVerified,
		});
		setModalOpen(true);
	};

	const handleSubmit = async () => {
		try {
			const values = await form.validateFields();
			setSaving(true);
			if (editingUser) {
				await updateSFn({
					data: { id: editingUser.id, ...values },
				});
				message.success("用户信息已更新");
			} else {
				await createSFn({ data: values });
				message.success("用户已创建");
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
			await deleteSFn({ data: { id } });
			message.success("用户已删除");
			await refresh();
		} catch (err) {
			message.error(err instanceof Error ? err.message : "删除失败");
		}
	};

	const handleResetPwd = (record: ClientUserRecord) => {
		setEditingUser(record);
		pwdForm.resetFields();
		setPwdModalOpen(true);
	};

	const handlePwdSubmit = async () => {
		try {
			const values = await pwdForm.validateFields();
			await resetPwdSFn({
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
			width: 220,
			ellipsis: true,
			sorter: true,
		},
		{
			title: "邮箱验证",
			dataIndex: "emailVerified",
			key: "emailVerified",
			width: 90,
			render: (v: boolean) =>
				v ? <Tag color="green">已验证</Tag> : <Tag color="default">未验证</Tag>,
		},
		{
			title: "状态",
			dataIndex: "status",
			key: "status",
			width: 80,
			render: (v: string) => <DictTag dictSlug="user_status" value={v} />,
		},
		{
			title: "最后登录",
			dataIndex: "lastLoginAt",
			key: "lastLoginAt",
			width: 185,
			valueType: "dateTime",
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
			fixed: "right" as const,
			render: (_: unknown, record: ClientUserRecord) => (
				<TableOperate>
					<TableOperate.Edit onClick={() => handleEdit(record)} />
					<TableOperate.Custom>
						<Button
							type="link"
							size="small"
							icon={<KeyOutlined />}
							onClick={() => handleResetPwd(record)}
						>
							重置密码
						</Button>
					</TableOperate.Custom>
					<TableOperate.Delete
						recordName="此用户"
						onConfirm={() => handleDelete(record.id)}
					/>
				</TableOperate>
			),
		},
	];

	return (
		<AdminPageContent
			title="客户端用户管理"
			description="管理前台注册用户账号与状态"
			extra={
				<Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
					新建用户
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
				locale={{ emptyText: "暂无用户" }}
				scroll={{ x: 1350 }}
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
				title={editingUser ? "编辑用户" : "新建用户"}
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
						<Input placeholder="user@example.com" />
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
					{editingUser && (
						<>
							<Form.Item name="status" label="状态">
								<DictSelect dictSlug="user_status" />
							</Form.Item>
							<Form.Item
								name="emailVerified"
								label="邮箱验证"
								valuePropName="checked"
							>
								<Switch />
							</Form.Item>
						</>
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
