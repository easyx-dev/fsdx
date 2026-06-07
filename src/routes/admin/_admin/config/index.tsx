/**
 * 系统配置管理页面：键值对 CRUD（antd Table + Form + Modal）
 */
import {
	CloseOutlined,
	DeleteOutlined,
	EditOutlined,
	PlusOutlined,
} from "@ant-design/icons";
import { createFileRoute, useRouter } from "@tanstack/react-router";
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
	Typography,
} from "antd";
import { useState } from "react";
import { z } from "zod";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { permGuard } from "#/middleware/server-fn-auth";
import {
	type ConfigRecord,
	createConfig,
	deleteConfig,
	getConfigList as getConfigListService,
	updateConfig,
} from "#/server/config";

const { Text } = Typography;

const createConfigSchema = z.object({
	key: z.string().min(1, "配置键不能为空").max(100),
	value: z.string().min(1, "配置值不能为空"),
	description: z.string().optional(),
});
const updateConfigSchema = z.object({
	id: z.string().min(1),
	value: z.string().optional(),
	description: z.string().optional(),
});
const deleteConfigSchema = z.object({ id: z.string().min(1) });

const getConfigList = createServerFn({ method: "GET" })
	.middleware([permGuard(PERMISSIONS.CONFIG_VIEW)])
	.handler(async () => {
		return getConfigListService();
	});

const createConfigFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.CONFIG_CREATE)])
	.inputValidator(createConfigSchema)
	.handler(async ({ data }) => {
		await createConfig(data);
		return { success: true };
	});

const updateConfigFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.CONFIG_EDIT)])
	.inputValidator(updateConfigSchema)
	.handler(async ({ data }) => {
		const { id, ...rest } = data;
		await updateConfig(id, rest);
		return { success: true };
	});

const deleteConfigFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.CONFIG_DELETE)])
	.inputValidator(deleteConfigSchema)
	.handler(async ({ data }) => {
		await deleteConfig(data.id);
		return { success: true };
	});

export const Route = createFileRoute("/admin/_admin/config/")({
	component: ConfigPage,
	loader: async () => await getConfigList(),
});

function ConfigPage() {
	const router = useRouter();
	const configs = Route.useLoaderData();
	const [modalOpen, setModalOpen] = useState(false);
	const [editing, setEditing] = useState<ConfigRecord | null>(null);
	const [form] = Form.useForm();

	/** 打开新建/编辑弹窗 */
	const openModal = (record?: ConfigRecord) => {
		if (record) {
			setEditing(record);
			form.setFieldsValue({
				key: record.key,
				value: record.value,
				description: record.description ?? "",
			});
		} else {
			setEditing(null);
			form.resetFields();
		}
		setModalOpen(true);
	};

	/** 关闭弹窗并清理表单 */
	const closeModal = () => {
		setModalOpen(false);
		setEditing(null);
		form.resetFields();
	};

	/** 提交表单 */
	const handleSubmit = async () => {
		try {
			const values = await form.validateFields();
			if (editing) {
				await updateConfigFn({
					data: {
						id: editing.id,
						value: values.value,
						description: values.description || undefined,
					},
				});
				message.success("配置更新成功");
			} else {
				await createConfigFn({
					data: {
						key: values.key,
						value: values.value,
						description: values.description || undefined,
					},
				});
				message.success("配置创建成功");
			}
			closeModal();
			router.invalidate();
		} catch (err) {
			// validateFields 校验失败会 throw，无需额外处理
			if (err instanceof Error && err.message !== "VALIDATE_ERROR") {
				message.error(err.message || "操作失败");
			}
		}
	};

	/** 删除配置 */
	const handleDelete = async (id: string) => {
		await deleteConfigFn({ data: { id } });
		message.success("已删除");
		router.invalidate();
	};

	const columns = [
		{
			title: "配置键",
			dataIndex: "key",
			key: "key",
			width: 240,
			render: (key: string) => (
				<Text copyable style={{ fontFamily: "monospace", fontSize: 13 }}>
					{key}
				</Text>
			),
		},
		{
			title: "配置值",
			dataIndex: "value",
			key: "value",
			render: (value: string) => (
				<Text
					copyable
					ellipsis={{ tooltip: true }}
					style={{ maxWidth: 360, fontFamily: "monospace", fontSize: 13 }}
				>
					{value}
				</Text>
			),
		},
		{
			title: "描述",
			dataIndex: "description",
			key: "description",
			render: (desc: string | null) => desc || "—",
		},
		{
			title: "操作",
			key: "actions",
			width: 120,
			render: (_: unknown, record: ConfigRecord) => (
				<Space size={4}>
					<Button
						type="text"
						size="small"
						icon={<EditOutlined />}
						onClick={() => openModal(record)}
					/>
					<Popconfirm
						title="确定删除该配置？"
						onConfirm={() => handleDelete(record.id)}
					>
						<Button type="text" size="small" danger icon={<DeleteOutlined />} />
					</Popconfirm>
				</Space>
			),
		},
	];

	return (
		<AdminPageContent
			title="系统配置"
			extra={
				<Button
					type="primary"
					icon={<PlusOutlined />}
					onClick={() => openModal()}
				>
					新建配置
				</Button>
			}
		>
			<Table
				dataSource={configs}
				columns={columns}
				rowKey="id"
				locale={{ emptyText: "暂无配置" }}
			/>

			<Modal
				title={editing ? "编辑配置" : "新建配置"}
				open={modalOpen}
				onOk={handleSubmit}
				onCancel={closeModal}
				okText={editing ? "保存" : "创建"}
				cancelText="取消"
				closeIcon={<CloseOutlined />}
				destroyOnClose
			>
				<Form form={form} layout="vertical" className="mt-4">
					<Form.Item
						name="key"
						label="配置键"
						rules={[
							{ required: true, message: "请输入配置键" },
							{ max: 100, message: "配置键不能超过100个字符" },
						]}
					>
						<Input
							disabled={!!editing}
							placeholder="配置键"
							style={{ fontFamily: "monospace" }}
						/>
					</Form.Item>
					<Form.Item
						name="value"
						label="配置值"
						rules={[{ required: true, message: "请输入配置值" }]}
					>
						<Input.TextArea rows={3} placeholder="配置值" />
					</Form.Item>
					<Form.Item name="description" label="描述">
						<Input placeholder="描述（可选）" />
					</Form.Item>
				</Form>
			</Modal>
		</AdminPageContent>
	);
}
