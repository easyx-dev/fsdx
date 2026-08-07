/**
 * 元事件管理页面：CRUD 元事件定义
 */
import { PlusOutlined } from "@ant-design/icons";
import { message } from "@fsdx/ui-spa/antd-static";
import { ProTable, TableOperate } from "@fsdx/ui-spa/table";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Form, Input, Modal, Tag } from "antd";
import { useState } from "react";
import { AdminPageContent } from "#/components/admin";
import { getTrackEventMetaSFn } from "#/services/track/track.functions";
import type { TrackEventMetaRecord as PresetEventRecord } from "#/services/track/track.types";
import {
	createEventMetaSFn,
	deleteEventMetaSFn,
	updateEventMetaSFn,
} from "./-mods/event-meta.functions";

export const Route = createFileRoute("/admin/_admin/track/event-meta/")({
	component: PresetEventsPage,
	loader: async () => getTrackEventMetaSFn(),
});

function PresetEventsPage() {
	const initialEvents = Route.useLoaderData();
	const [events, setEvents] = useState<PresetEventRecord[]>(initialEvents);
	const [modalOpen, setModalOpen] = useState(false);
	const [editingEvent, setEditingEvent] = useState<PresetEventRecord | null>(
		null,
	);
	const [saving, setSaving] = useState(false);
	const [form] = Form.useForm();

	const refresh = async () => {
		const data = await getTrackEventMetaSFn();
		setEvents(data);
	};

	const handleCreate = () => {
		setEditingEvent(null);
		form.resetFields();
		setModalOpen(true);
	};

	const handleEdit = (record: PresetEventRecord) => {
		setEditingEvent(record);
		form.setFieldsValue({
			label: record.label,
			category: record.category,
			description: record.description ?? "",
		});
		setModalOpen(true);
	};

	const handleSubmit = async () => {
		try {
			const values = await form.validateFields();
			setSaving(true);
			if (editingEvent) {
				await updateEventMetaSFn({
					data: { name: editingEvent.name, ...values },
				});
				message.success("元事件已更新");
			} else {
				await createEventMetaSFn({ data: values });
				message.success("元事件已创建");
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

	const handleDelete = async (name: string) => {
		try {
			const result = await deleteEventMetaSFn({ data: { name } });
			if (result) {
				message.success("元事件已删除");
				await refresh();
			} else {
				message.error("预置事件不可删除");
			}
		} catch (err) {
			message.error(err instanceof Error ? err.message : "删除失败");
		}
	};

	const columns = [
		{
			title: "事件标识",
			dataIndex: "name",
			key: "name",
			width: 150,
			render: (v: string) => <code className="text-xs">{v}</code>,
		},
		{
			title: "显示名称",
			dataIndex: "label",
			key: "label",
			width: 150,
		},
		{
			title: "分类",
			dataIndex: "category",
			key: "category",
			width: 120,
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
			render: (_: unknown, record: PresetEventRecord) => (
				<TableOperate>
					<TableOperate.Edit onClick={() => handleEdit(record)} />
					{!record.isPreset && (
						<TableOperate.Delete
							recordName="此元事件"
							onConfirm={() => handleDelete(record.name)}
						/>
					)}
				</TableOperate>
			),
		},
	];

	return (
		<AdminPageContent
			title="元事件管理"
			description="管理系统预置和自定义的事件类型定义"
			extra={
				<Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
					新建事件
				</Button>
			}
		>
			<ProTable
				columns={columns}
				dataSource={events}
				rowKey="name"
				scroll={{ x: 1100 }}
				locale={{ emptyText: "暂无元事件" }}
			/>

			<Modal
				title={editingEvent ? "编辑元事件" : "新建元事件"}
				open={modalOpen}
				onCancel={() => setModalOpen(false)}
				onOk={handleSubmit}
				confirmLoading={saving}
				width={500}
				destroyOnHidden
			>
				<Form form={form} layout="vertical" className="mt-4">
					<Form.Item
						name="name"
						label="事件标识"
						rules={[{ required: true, message: "请输入事件标识" }]}
					>
						<Input placeholder="如：PageView" disabled={!!editingEvent} />
					</Form.Item>
					<Form.Item
						name="label"
						label="显示名称"
						rules={[{ required: true, message: "请输入显示名称" }]}
					>
						<Input placeholder="如：页面浏览" />
					</Form.Item>
					<Form.Item
						name="category"
						label="分类"
						rules={[{ required: true, message: "请选择分类" }]}
					>
						<Input placeholder="如：页面交互" />
					</Form.Item>
					<Form.Item name="description" label="描述">
						<Input.TextArea rows={2} placeholder="事件描述（可选）" />
					</Form.Item>
				</Form>
			</Modal>
		</AdminPageContent>
	);
}
