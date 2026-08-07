/**
 * 字典创建/编辑弹窗表单
 */

import type { FormInstance } from "antd";
import { Button, Form, Input, Modal, Space } from "antd";
import type { DictRecord } from "#/services/dict/dict.server";

interface DictFormModalProps {
	open: boolean;
	editing: DictRecord | null;
	form: FormInstance;
	/** slug 输入是否禁用（预置字典不可改标识） */
	slugDisabled: boolean;
	onCancel: () => void;
	onSubmit: (values: Record<string, unknown>) => void;
}

/** 字典创建/编辑弹窗：名称 + 标识 + 描述 */
export function DictFormModal({
	open,
	editing,
	form,
	slugDisabled,
	onCancel,
	onSubmit,
}: DictFormModalProps) {
	return (
		<Modal
			title={editing ? "编辑字典" : "新建字典"}
			open={open}
			onCancel={onCancel}
			footer={null}
			destroyOnHidden
		>
			<Form form={form} layout="vertical" onFinish={onSubmit}>
				<Form.Item
					name="name"
					label="名称"
					rules={[{ required: true, message: "请输入字典名称" }]}
				>
					<Input placeholder="字典名称" />
				</Form.Item>
				<Form.Item
					name="slug"
					label="标识 (slug)"
					rules={[{ required: true, message: "请输入字典标识" }]}
				>
					<Input placeholder="唯一标识" disabled={slugDisabled} />
				</Form.Item>
				<Form.Item name="description" label="描述">
					<Input.TextArea rows={2} placeholder="字典描述（可选）" />
				</Form.Item>
				<Form.Item className="mb-0 text-right">
					<Space>
						<Button onClick={onCancel}>取消</Button>
						<Button type="primary" htmlType="submit">
							{editing ? "保存" : "创建"}
						</Button>
					</Space>
				</Form.Item>
			</Form>
		</Modal>
	);
}
