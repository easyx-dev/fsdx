/**
 * 设置面板：统一展示/编辑包配置项（保存后生效）
 * 编辑内容暂存于 Form，点击「保存」后回写 runtimeConfig 并触发 onConfigChange
 */
import {
	Button,
	Collapse,
	Drawer,
	Form,
	Input,
	Switch,
	Tag,
	Typography,
} from "antd";
import { useEffect } from "react";
import { SETTINGS_DRAWER_WIDTH } from "../constants";
import { buildDefaultSystemPrompt } from "../prompts";
import type { AiRichEditorConfig } from "../types";

const { Paragraph, Text } = Typography;

interface SettingsPanelProps {
	open: boolean;
	/** 当前生效的配置（用于初始化表单与只读展示） */
	config: AiRichEditorConfig;
	onClose: () => void;
	onSave: (config: AiRichEditorConfig) => void;
}

/** 设置面板可编辑字段（notify 为只读展示，不在此表单项内；height 为顶层 prop） */
type SettingsFormValues = {
	autoApply: boolean;
	systemPrompt?: string;
	previewHead?: string;
};

export function SettingsPanel({
	open,
	config,
	onClose,
	onSave,
}: SettingsPanelProps) {
	const [form] = Form.useForm<SettingsFormValues>();
	// 实时监听自定义提示词是否填写，用于切换「当前生效」标识
	const customPrompt = Form.useWatch("systemPrompt", form);
	const hasCustomPrompt = Boolean(customPrompt?.trim());

	// 打开时用当前配置初始化表单
	useEffect(() => {
		if (open) {
			form.setFieldsValue({
				autoApply: config.autoApply ?? true,
				systemPrompt: config.systemPrompt ?? "",
				previewHead: config.previewHead ?? "",
			});
		}
	}, [open, config, form]);

	const handleOk = async () => {
		const values = await form.validateFields();
		onSave({
			...config,
			autoApply: values.autoApply,
			systemPrompt: values.systemPrompt?.trim()
				? values.systemPrompt
				: undefined,
			previewHead: values.previewHead?.trim() ? values.previewHead : undefined,
		});
	};

	return (
		<Drawer
			title="设置"
			width={SETTINGS_DRAWER_WIDTH}
			open={open}
			onClose={onClose}
			extra={
				<>
					<Button size="small" onClick={onClose}>
						取消
					</Button>
					<Button size="small" type="primary" onClick={() => void handleOk()}>
						保存
					</Button>
				</>
			}
		>
			<Form form={form} layout="vertical" requiredMark={false}>
				<Form.Item
					label="自动应用到编辑器"
					name="autoApply"
					valuePropName="checked"
				>
					<Switch checkedChildren="开" unCheckedChildren="关" />
				</Form.Item>

				{/* 生效状态：随「是否填写自定义提示词」切换 */}
				<div className="mb-2 flex items-center gap-2">
					<Text type="secondary">当前生效：</Text>
					<Tag color={hasCustomPrompt ? "blue" : "default"}>
						{hasCustomPrompt ? "自定义" : "内置默认"}
					</Tag>
				</div>
				<Form.Item label="自定义 system 提示词" name="systemPrompt">
					<Input.TextArea rows={6} placeholder="留空则使用内置默认提示词" />
				</Form.Item>

				<Form.Item label="预览附加代码（注入 &lt;head&gt;）" name="previewHead">
					<Input.TextArea
						rows={5}
						placeholder="如：<style>body{...}</style>，原样注入预览 head"
					/>
				</Form.Item>
			</Form>

			<div className="mt-2">
				<Text type="secondary">
					消息提示：
					{config.notify ? "已配置（宿主回调）" : "使用默认 antd 提示"}
				</Text>
			</div>

			{/* 内置默认提示词（只读参考，默认折叠） */}
			<Collapse
				className="mt-4"
				size="small"
				items={[
					{
						key: "default-prompt",
						label: "内置默认提示词",
						children: (
							<Paragraph className="mb-0 whitespace-pre-wrap rounded border border-border bg-background-secondary p-3 text-xs leading-relaxed text-muted-foreground">
								{buildDefaultSystemPrompt()}
							</Paragraph>
						),
					},
				]}
			/>
		</Drawer>
	);
}
