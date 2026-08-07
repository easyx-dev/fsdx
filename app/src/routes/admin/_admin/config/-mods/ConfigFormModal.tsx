/**
 * 系统配置创建/编辑弹窗表单
 */

import type { FormInstance } from "antd";
import { Button, Form, Input, Modal, Space, Switch } from "antd";
import { EditorTypes } from "#/components/admin";
import type { EditorType } from "#/constants/editor-types";
import type { ConfigRecord } from "#/services/config/config.server";

interface ConfigFormModalProps {
	open: boolean;
	editing: ConfigRecord | null;
	form: FormInstance;
	onCancel: () => void;
	onSubmit: () => void;
}

/** 系统配置创建/编辑弹窗：键 + 值类型联动编辑器 + 分组/可见性 */
export function ConfigFormModal({
	open,
	editing,
	form,
	onCancel,
	onSubmit,
}: ConfigFormModalProps) {
	const watchedValueType = Form.useWatch("valueType", form) as
		| EditorType
		| undefined;

	return (
		<Modal
			title={editing ? "编辑配置" : "新建配置"}
			open={open}
			onCancel={onCancel}
			footer={null}
			destroyOnHidden
		>
			<Form form={form} layout="vertical" onFinish={onSubmit} className="mt-4">
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
				<Form.Item name="valueType" label="值类型">
					<EditorTypes.Select allowClear placeholder="默认文本" />
				</Form.Item>
				{watchedValueType ? (
					<Form.Item
						name="value"
						label="配置值"
						rules={[{ required: true, message: "请输入配置值" }]}
					>
						<EditorTypes.Editor type={watchedValueType} placeholder="配置值" />
					</Form.Item>
				) : (
					<Form.Item
						name="value"
						label="配置值"
						rules={[{ required: true, message: "请输入配置值" }]}
					>
						<Input.TextArea rows={4} placeholder="配置值" />
					</Form.Item>
				)}
				<Form.Item name="groupName" label="配置分组">
					<Input placeholder="分组（可选，为空归入未分组）" />
				</Form.Item>
				<Form.Item
					name="clientVisible"
					label="客户端可见"
					valuePropName="checked"
				>
					<Switch />
				</Form.Item>
				<Form.Item name="description" label="描述">
					<Input.TextArea rows={2} placeholder="描述（可选）" />
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
