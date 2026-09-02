/**
 * AI 模型测试页面（单模型非流式）
 */
import { RobotOutlined, SendOutlined } from "@ant-design/icons";
import { message } from "@fsdx/ui-spa/antd-static";
import { createFileRoute } from "@tanstack/react-router";
import {
	Button,
	Card,
	Form,
	Input,
	InputNumber,
	Select,
	Slider,
	Space,
	Typography,
} from "antd";
import { useState } from "react";
import type { z } from "zod";
import { AdminPageContent } from "#/components/admin";
import type { AiProviderView } from "#/services/ai/ai.schemas";
import { getAiProvidersSFn } from "#/services/ai/ai-providers.functions";
import { type aiTestSchema, aiTestSFn } from "./-mods/ai.functions";

const { Text, Paragraph } = Typography;

type AiTestInput = z.infer<typeof aiTestSchema>;

export const Route = createFileRoute("/admin/_admin/demo/ai")({
	loader: async () => {
		try {
			return await getAiProvidersSFn();
		} catch {
			return [];
		}
	},
	component: AiDemoPage,
});

function AiDemoPage() {
	const providers = Route.useLoaderData() as AiProviderView[];
	const [form] = Form.useForm<AiTestInput>();
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState<string | null>(null);

	const handleSubmit = async (values: AiTestInput) => {
		setLoading(true);
		setResult(null);
		try {
			const res = await aiTestSFn({ data: values });
			setResult(res);
		} catch (err) {
			message.error(err instanceof Error ? err.message : "AI 调用失败");
		} finally {
			setLoading(false);
		}
	};

	return (
		<AdminPageContent
			title="AI 模型测试"
			description="测试默认 AI 厂商的调用效果"
		>
			<div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
				<Card title="请求参数" size="small">
					<Form
						form={form}
						layout="vertical"
						onFinish={handleSubmit}
						initialValues={{
							temperature: 0.7,
						}}
					>
						{providers.length > 0 && (
							<Form.Item name="providerId" label="AI 厂商">
								<Select
									allowClear
									placeholder="默认厂商"
									options={providers.map((p) => ({
										value: p.id,
										label: p.name,
									}))}
								/>
							</Form.Item>
						)}

						<Form.Item name="systemMessage" label="System 消息（可选）">
							<Input.TextArea
								rows={2}
								placeholder="设定 AI 的角色和行为，如「你是一个专业的技术翻译」"
							/>
						</Form.Item>

						<Form.Item
							name="userMessage"
							label="User 消息"
							rules={[{ required: true, message: "请输入消息内容" }]}
						>
							<Input.TextArea rows={4} placeholder="输入要发送给 AI 的消息" />
						</Form.Item>

						<Form.Item name="temperature" label="Temperature">
							<Slider
								min={0}
								max={2}
								step={0.1}
								marks={{ 0: "0", 1: "1", 2: "2" }}
							/>
						</Form.Item>

						<Form.Item name="maxTokens" label="Max Tokens（可选）">
							<InputNumber
								min={1}
								max={16384}
								placeholder="不填则使用模型默认值"
								className="w-full"
							/>
						</Form.Item>

						<Form.Item className="mb-0">
							<Button
								type="primary"
								htmlType="submit"
								icon={<SendOutlined />}
								loading={loading}
								block
							>
								发送
							</Button>
						</Form.Item>
					</Form>
				</Card>

				<Card
					title={
						<Space>
							<RobotOutlined />
							<span>AI 回复</span>
						</Space>
					}
					size="small"
				>
					{result !== null ? (
						<div className="space-y-3">
							<Card size="small" className="bg-muted/30">
								<Paragraph
									className="mb-0 whitespace-pre-wrap"
									style={{ whiteSpace: "pre-wrap" }}
								>
									{result || "(空回复)"}
								</Paragraph>
							</Card>
						</div>
					) : loading ? (
						<Text type="secondary">正在调用 AI，请稍候...</Text>
					) : (
						<Text type="secondary">尚未发送消息，请在左侧输入并点击发送</Text>
					)}
				</Card>
			</div>
		</AdminPageContent>
	);
}
