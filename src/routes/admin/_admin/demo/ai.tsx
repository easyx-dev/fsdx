/**
 * AI 模型测试页面：支持深度思考与快速模型调用测试
 */
import { RobotOutlined, SendOutlined } from "@ant-design/icons";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
	Button,
	Card,
	Form,
	Input,
	InputNumber,
	Select,
	Slider,
	Space,
	Tag,
	Typography,
} from "antd";
import { useState } from "react";
import { z } from "zod";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import { type ChatMessage, deepChat, fastChat } from "#/lib/ai/ai";

const { Text, Paragraph } = Typography;

const aiTestSchema = z.object({
	modelType: z.enum(["deep", "fast"]),
	systemMessage: z.string().optional(),
	userMessage: z.string().min(1, "请输入消息内容"),
	temperature: z.number().min(0).max(2).default(0.7),
	maxTokens: z.number().int().min(1).max(16384).optional(),
});

type AiTestInput = z.infer<typeof aiTestSchema>;

const aiTestFn = createServerFn({ method: "POST" })
	.inputValidator(aiTestSchema)
	.handler(async ({ data }) => {
		const messages: ChatMessage[] = [];
		if (data.systemMessage) {
			messages.push({ role: "system", content: data.systemMessage });
		}
		messages.push({ role: "user", content: data.userMessage });

		const chatFn = data.modelType === "deep" ? deepChat : fastChat;
		return chatFn(messages, {
			temperature: data.temperature,
			maxTokens: data.maxTokens,
		});
	});

export const Route = createFileRoute("/admin/_admin/demo/ai")({
	component: AiDemoPage,
});

/** AI 调用结果 */
interface CallResult {
	content: string;
	model: string;
	usage?: {
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	};
}

function AiDemoPage() {
	const [form] = Form.useForm<AiTestInput>();
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState<CallResult | null>(null);

	const handleSubmit = async (values: AiTestInput) => {
		setLoading(true);
		setResult(null);
		try {
			const res = await aiTestFn({ data: values });
			setResult(res);
		} finally {
			setLoading(false);
		}
	};

	return (
		<AdminPageContent
			title="AI 模型测试"
			description="测试深度思考模型和快速模型的调用效果"
		>
			<div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
				<Card title="请求参数" size="small">
					<Form
						form={form}
						layout="vertical"
						onFinish={handleSubmit}
						initialValues={{
							modelType: "deep",
							temperature: 0.7,
						}}
					>
						<Form.Item
							name="modelType"
							label="模型类型"
							rules={[{ required: true }]}
						>
							<Select
								options={[
									{ value: "deep", label: "深度思考模型（默认）" },
									{ value: "fast", label: "快速模型" },
								]}
							/>
						</Form.Item>

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
					{result ? (
						<div className="space-y-3">
							<div className="flex flex-wrap gap-2">
								<Tag color="blue">{result.model}</Tag>
								{result.usage && (
									<>
										<Tag>输入: {result.usage.promptTokens} tokens</Tag>
										<Tag>输出: {result.usage.completionTokens} tokens</Tag>
										<Tag>合计: {result.usage.totalTokens} tokens</Tag>
									</>
								)}
							</div>
							<Card size="small" className="bg-muted/30">
								<Paragraph
									className="mb-0 whitespace-pre-wrap"
									style={{ whiteSpace: "pre-wrap" }}
								>
									{result.content || "(空回复)"}
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
