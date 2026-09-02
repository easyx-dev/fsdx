/**
 * AI 厂商 新增/编辑弹窗
 */
import { Form, Input, Modal, Switch } from "antd";
import { useEffect } from "react";
import type { AiProviderConfig } from "#/services/ai/ai.schemas";

interface Props {
	open: boolean;
	editing: AiProviderConfig | null;
	onSubmit: (provider: AiProviderConfig) => void;
	onCancel: () => void;
}

/** 表单值（不含 default，default 由整列表保存时统一处理读回） */
interface FormValues {
	id: string;
	name: string;
	baseUrl: string;
	apiKey: string;
	model: string;
	default?: boolean;
}

export function AiProviderFormModal({
	open,
	editing,
	onSubmit,
	onCancel,
}: Props) {
	const [form] = Form.useForm<FormValues>();

	useEffect(() => {
		if (!open) return;
		if (editing) {
			form.setFieldsValue(editing);
		} else {
			form.resetFields();
		}
	}, [open, editing, form]);

	const handleOk = async () => {
		const values = await form.validateFields();
		const trimmed = {
			...values,
			id: values.id.trim(),
			name: values.name.trim(),
			baseUrl: values.baseUrl.trim(),
			apiKey: values.apiKey.trim(),
			model: values.model.trim(),
			default: values.default ?? false,
		};
		onSubmit(trimmed);
	};

	return (
		<Modal
			title={editing ? "编辑 AI 厂商" : "新增 AI 厂商"}
			open={open}
			onOk={handleOk}
			onCancel={onCancel}
			destroyOnHidden
		>
			<Form form={form} layout="vertical" preserve={false}>
				<Form.Item
					name="id"
					label="厂商 ID"
					rules={[
						{ required: true, message: "请输入厂商 ID" },
						{ max: 64, message: "最多 64 字符" },
					]}
					tooltip="调用侧引用标识，如 deepseek / moonshot"
				>
					<Input placeholder="如 deepseek" disabled={!!editing} />
				</Form.Item>
				<Form.Item
					name="name"
					label="厂商名称"
					rules={[{ required: true, message: "请输入厂商名称" }]}
				>
					<Input placeholder="如 DeepSeek" />
				</Form.Item>
				<Form.Item
					name="baseUrl"
					label="API 基础地址"
					rules={[{ required: true, message: "请输入 API 基础地址" }]}
				>
					<Input placeholder="如 https://api.deepseek.com/v1" />
				</Form.Item>
				<Form.Item
					name="apiKey"
					label="API 密钥"
					rules={[{ required: true, message: "请输入 API 密钥" }]}
				>
					<Input.Password placeholder="sk-..." />
				</Form.Item>
				<Form.Item
					name="model"
					label="模型名"
					rules={[{ required: true, message: "请输入模型名" }]}
				>
					<Input placeholder="如 deepseek-chat" />
				</Form.Item>
				<Form.Item name="default" label="设为默认厂商" valuePropName="checked">
					<Switch />
				</Form.Item>
			</Form>
		</Modal>
	);
}
