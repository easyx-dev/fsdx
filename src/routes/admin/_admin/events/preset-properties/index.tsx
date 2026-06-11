/**
 * 预设属性管理页面：CRUD 预设属性定义
 */
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { createFileRoute } from "@tanstack/react-router";
import {
	Button,
	Form,
	Input,
	Modal,
	message,
	Popconfirm,
	Select,
	Space,
	Table,
	Tag,
} from "antd";
import { useState } from "react";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import {
	createPresetPropertyFn,
	deletePresetPropertyFn,
	getPresetPropertiesFn,
	PROPERTY_DATA_TYPES,
	updatePresetPropertyFn,
} from "#/server/event/event.functions";
import type { PresetPropertyRecord } from "#/server/event/event.types";

export const Route = createFileRoute("/admin/_admin/events/preset-properties/")(
	{
		component: PresetPropertiesPage,
		loader: async () => getPresetPropertiesFn(),
	},
);

function PresetPropertiesPage() {
	const initialProperties = Route.useLoaderData();
	const [properties, setProperties] =
		useState<PresetPropertyRecord[]>(initialProperties);
	const [modalOpen, setModalOpen] = useState(false);
	const [editingProp, setEditingProp] = useState<PresetPropertyRecord | null>(
		null,
	);
	const [saving, setSaving] = useState(false);
	const [form] = Form.useForm();

	const refresh = async () => {
		const data = await getPresetPropertiesFn();
		setProperties(data);
	};

	const handleCreate = () => {
		setEditingProp(null);
		form.resetFields();
		form.setFieldsValue({ dataType: "string" });
		setModalOpen(true);
	};

	const handleEdit = (record: PresetPropertyRecord) => {
		setEditingProp(record);
		form.setFieldsValue({
			label: record.label,
			dataType: record.dataType,
			description: record.description ?? "",
		});
		setModalOpen(true);
	};

	const handleSubmit = async () => {
		try {
			const values = await form.validateFields();
			setSaving(true);
			if (editingProp) {
				await updatePresetPropertyFn({
					data: { key: editingProp.key, ...values },
				});
				message.success("预设属性已更新");
			} else {
				await createPresetPropertyFn({ data: values });
				message.success("预设属性已创建");
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

	const handleDelete = async (key: string) => {
		try {
			const result = await deletePresetPropertyFn({ data: { key } });
			if (result) {
				message.success("预设属性已删除");
				await refresh();
			} else {
				message.error("预置属性不可删除");
			}
		} catch (err) {
			message.error(err instanceof Error ? err.message : "删除失败");
		}
	};

	const columns = [
		{
			title: "属性键",
			dataIndex: "key",
			key: "key",
			width: 160,
			render: (v: string) => <code className="text-xs">{v}</code>,
		},
		{
			title: "显示名称",
			dataIndex: "label",
			key: "label",
			width: 150,
		},
		{
			title: "数据类型",
			dataIndex: "dataType",
			key: "dataType",
			width: 100,
			render: (v: string) => <Tag>{v}</Tag>,
		},
		{
			title: "描述",
			dataIndex: "description",
			key: "description",
			ellipsis: true,
		},
		{
			title: "类型",
			dataIndex: "isPreset",
			key: "isPreset",
			width: 100,
			render: (v: boolean) =>
				v ? <Tag color="blue">系统预置</Tag> : <Tag color="green">自定义</Tag>,
		},
		{
			title: "操作",
			key: "actions",
			width: 160,
			render: (_: unknown, record: PresetPropertyRecord) => (
				<Space size={4}>
					<Button
						type="link"
						size="small"
						icon={<EditOutlined />}
						onClick={() => handleEdit(record)}
					>
						编辑
					</Button>
					{!record.isPreset && (
						<Popconfirm
							title="确定删除此预设属性？"
							onConfirm={() => handleDelete(record.key)}
						>
							<Button type="link" size="small" danger icon={<DeleteOutlined />}>
								删除
							</Button>
						</Popconfirm>
					)}
				</Space>
			),
		},
	];

	return (
		<AdminPageContent
			title="预设属性管理"
			description="管理系统预置和自定义的事件属性字段定义"
			extra={
				<Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
					新建属性
				</Button>
			}
		>
			<Table
				columns={columns}
				dataSource={properties}
				rowKey="key"
				scroll={{ x: 900 }}
				locale={{ emptyText: "暂无预设属性" }}
			/>

			<Modal
				title={editingProp ? "编辑预设属性" : "新建预设属性"}
				open={modalOpen}
				onCancel={() => setModalOpen(false)}
				onOk={handleSubmit}
				confirmLoading={saving}
				width={500}
				destroyOnHidden
			>
				<Form form={form} layout="vertical" className="mt-4">
					<Form.Item
						name="key"
						label="属性键"
						rules={[{ required: true, message: "请输入属性键" }]}
					>
						<Input placeholder="如：page_name" disabled={!!editingProp} />
					</Form.Item>
					<Form.Item
						name="label"
						label="显示名称"
						rules={[{ required: true, message: "请输入显示名称" }]}
					>
						<Input placeholder="如：页面名称" />
					</Form.Item>
					<Form.Item name="dataType" label="数据类型">
						<Select
							options={PROPERTY_DATA_TYPES.map((t) => ({
								label: t.label,
								value: t.value,
							}))}
						/>
					</Form.Item>
					<Form.Item name="description" label="描述">
						<Input.TextArea rows={2} placeholder="属性描述（可选）" />
					</Form.Item>
				</Form>
			</Modal>
		</AdminPageContent>
	);
}
