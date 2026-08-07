/**
 * 字典条目创建/编辑弹窗表单（含高级配置区）
 */
import { CaretDownOutlined, CaretUpOutlined } from "@ant-design/icons";
import type { FormInstance } from "antd";
import {
	Button,
	Col,
	ColorPicker,
	Divider,
	Form,
	Input,
	InputNumber,
	Modal,
	Row,
	Space,
} from "antd";
import { EditorTypes } from "#/components/admin";
import type { EditorType } from "#/constants/editor-types";
import type { DictItemRecord } from "#/services/dict/dict.server";

interface DictItemFormModalProps {
	open: boolean;
	editing: DictItemRecord | null;
	form: FormInstance;
	/** 值输入是否禁用（预置字典条目不可改值） */
	valueDisabled: boolean;
	advancedExpanded: boolean;
	onToggleAdvanced: () => void;
	onCancel: () => void;
	onSubmit: (values: Record<string, unknown>) => void;
}

/** 字典条目创建/编辑弹窗：标签/值 + 高级配置（排序、颜色、额外类型与值） */
export function DictItemFormModal({
	open,
	editing,
	form,
	valueDisabled,
	advancedExpanded,
	onToggleAdvanced,
	onCancel,
	onSubmit,
}: DictItemFormModalProps) {
	const watchedExtraType = Form.useWatch("extraType", form) as
		| EditorType
		| undefined;

	return (
		<Modal
			title={editing ? "编辑条目" : "新建条目"}
			open={open}
			onCancel={onCancel}
			footer={null}
			width={advancedExpanded ? 720 : 520}
			destroyOnHidden
		>
			<Form
				form={form}
				layout="vertical"
				onFinish={onSubmit}
				initialValues={{ sortOrder: 0 }}
			>
				<Form.Item
					name="label"
					label="标签"
					rules={[{ required: true, message: "请输入标签" }]}
				>
					<Input placeholder="显示名称" />
				</Form.Item>
				<Form.Item
					name="value"
					label="值"
					rules={[{ required: true, message: "请输入值" }]}
				>
					<Input placeholder="存储值" disabled={valueDisabled} />
				</Form.Item>
				<Divider plain style={{ margin: "8px 0 12px" }}>
					<Button
						type="link"
						size="small"
						className="px-0 text-xs"
						icon={
							advancedExpanded ? <CaretUpOutlined /> : <CaretDownOutlined />
						}
						onClick={onToggleAdvanced}
					>
						高级配置
					</Button>
				</Divider>
				{advancedExpanded && (
					<>
						<Row gutter={16}>
							<Col span={12}>
								<Form.Item name="sortOrder" label="排序">
									<InputNumber
										className="w-full"
										min={0}
										placeholder="排序序号"
									/>
								</Form.Item>
							</Col>
							<Col span={12}>
								<Form.Item
									name="color"
									label="颜色"
									getValueFromEvent={(
										color: { toHexString?: () => string } | string,
									) =>
										typeof color === "string"
											? color
											: (color?.toHexString?.() ?? undefined)
									}
								>
									<ColorPicker allowClear format="hex" />
								</Form.Item>
							</Col>
						</Row>
						<Form.Item name="extraType" label="额外类型">
							<EditorTypes.Select allowClear />
						</Form.Item>
						{watchedExtraType ? (
							<Form.Item name="extra" label="额外值">
								<EditorTypes.Editor
									type={watchedExtraType}
									placeholder="额外扩展值"
								/>
							</Form.Item>
						) : (
							<Form.Item name="extra" label="额外值">
								<Input.TextArea
									rows={3}
									placeholder="额外扩展值（选择额外类型后可切换编辑器）"
								/>
							</Form.Item>
						)}
					</>
				)}
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
