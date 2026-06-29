/**
 * 系统初始化页面：首次部署时创建 root 管理员与基础配置
 */
import {
	DownOutlined,
	LockOutlined,
	MailOutlined,
	MessageOutlined,
	RobotOutlined,
	UpOutlined,
	UserOutlined,
} from "@ant-design/icons";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
	Alert,
	Button,
	Divider,
	Form,
	Input,
	InputNumber,
	message,
	Space,
	Switch,
} from "antd";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AutofillBlocker } from "#/components/AutofillBlocker";
import { JsonImportButton } from "#/components/admin/JsonImportButton";
import {
	checkInitStatus as checkInitStatusService,
	type InitData,
	initSystem,
} from "#/server/init/init.server";

const checkInitStatusSFn = createServerFn({ method: "GET" }).handler(
	async () => {
		return checkInitStatusService();
	},
);

const initSchema = z
	.object({
		username: z.string().min(1, "用户名不能为空").max(50),
		password: z.string().min(6, "密码至少 6 位").max(100),
		confirmPassword: z.string().min(1, "请确认密码"),
		email: z.string().email("请输入有效的邮箱地址"),
		siteName: z.string().default("FSDX WEB"),
		smtpHost: z.string().optional(),
		smtpPort: z.number().int().optional(),
		smtpSecure: z.boolean().optional(),
		smtpUser: z.string().optional(),
		smtpPass: z.string().optional(),
		smtpFrom: z.string().optional(),
		aiBaseUrl: z.string().optional(),
		aiApiKey: z.string().optional(),
		aiDeepModel: z.string().optional(),
		aiFastModel: z.string().optional(),
		smsProvider: z.string().optional(),
		smsAccessKeyId: z.string().optional(),
		smsAccessKeySecret: z.string().optional(),
		smsSignName: z.string().optional(),
		smsTemplateCode: z.string().optional(),
	})
	.refine((d) => d.password === d.confirmPassword, {
		message: "两次输入的密码不一致",
		path: ["confirmPassword"],
	});

const initSFn = createServerFn({ method: "POST" })
	.inputValidator(initSchema)
	.handler(async ({ data }) => {
		const smtpProvided = !!(
			data.smtpHost ||
			data.smtpPort ||
			data.smtpUser ||
			data.smtpPass ||
			data.smtpFrom
		);

		const aiProvided = !!(
			data.aiBaseUrl ||
			data.aiApiKey ||
			data.aiDeepModel ||
			data.aiFastModel
		);

		const smsProvided = !!(
			data.smsProvider ||
			data.smsAccessKeyId ||
			data.smsAccessKeySecret ||
			data.smsSignName ||
			data.smsTemplateCode
		);

		const payload: InitData = {
			admin: {
				username: data.username,
				password: data.password,
				email: data.email,
			},
			siteName: data.siteName || "FSDX CMS",
			smtp: smtpProvided
				? {
						host: data.smtpHost,
						port: data.smtpPort,
						secure: data.smtpSecure,
						user: data.smtpUser,
						pass: data.smtpPass,
						from: data.smtpFrom,
					}
				: undefined,
			ai: aiProvided
				? {
						baseUrl: data.aiBaseUrl,
						apiKey: data.aiApiKey,
						deepModel: data.aiDeepModel,
						fastModel: data.aiFastModel,
					}
				: undefined,
			sms: smsProvided
				? {
						provider: data.smsProvider,
						accessKeyId: data.smsAccessKeyId,
						accessKeySecret: data.smsAccessKeySecret,
						signName: data.smsSignName,
						templateCode: data.smsTemplateCode,
					}
				: undefined,
		};

		return initSystem(payload);
	});

export const Route = createFileRoute("/admin/init")({
	beforeLoad: async () => {
		const initialized = await checkInitStatusSFn();
		if (initialized) {
			throw redirect({ to: "/admin/login" });
		}
	},
	component: AdminInitPage,
});
function AdminInitPage() {
	const navigate = useNavigate();
	const [form] = Form.useForm();
	const [loading, setLoading] = useState(false);
	const [smtpExpanded, setSmtpExpanded] = useState(false);
	const [aiExpanded, setAiExpanded] = useState(false);
	const [smsExpanded, setSmsExpanded] = useState(false);

	// 设置 message 默认 duration 为 5s
	useEffect(() => {
		message.config({ duration: 5 });
	}, []);
	const handleSubmit = async (values: z.infer<typeof initSchema>) => {
		setLoading(true);
		try {
			const result = await initSFn({ data: values });
			if (!result.success) {
				message.error(result.message || "初始化失败");
				return;
			}
			message.success(result.message);
			navigate({ to: "/admin/login" });
		} catch (err) {
			message.error(
				err instanceof Error ? err.message : "网络错误，请稍后重试",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
			<div className="w-full max-w-lg">
				<div className="rounded-lg border border-border bg-card p-8 shadow-sm">
					<h1 className="mb-4 text-center text-2xl font-bold">系统初始化</h1>
					<Alert
						title="检测到系统尚未初始化，请创建超级管理员账号并完成基础配置"
						type="warning"
						showIcon
						className="mb-4"
					/>
					<br />
					<JsonImportButton
						title="导入 JSON 配置快速填写"
						className="mb-4"
						block
						successMessage="JSON 配置已导入，请核对信息后提交"
						onImport={(jsonString) => {
							try {
								const json: Record<string, unknown> = JSON.parse(jsonString);
								const values: Record<string, unknown> = {};
								if (json.admin && typeof json.admin === "object") {
									const a = json.admin as Record<string, unknown>;
									if (a.username) values.username = a.username;
									if (a.password) {
										values.password = a.password;
										values.confirmPassword = a.password;
									}
									if (a.email) values.email = a.email;
								}
								if (json.siteName) values.siteName = json.siteName;
								if (json.smtp && typeof json.smtp === "object") {
									setSmtpExpanded(true);
									const s = json.smtp as Record<string, unknown>;
									if (s.host) values.smtpHost = s.host;
									if (s.port !== undefined) values.smtpPort = s.port;
									if (s.secure !== undefined) values.smtpSecure = s.secure;
									if (s.user) values.smtpUser = s.user;
									if (s.pass) values.smtpPass = s.pass;
									if (s.from) values.smtpFrom = s.from;
								}
								if (json.ai && typeof json.ai === "object") {
									setAiExpanded(true);
									const ai = json.ai as Record<string, unknown>;
									if (ai.baseUrl) values.aiBaseUrl = ai.baseUrl;
									if (ai.apiKey) values.aiApiKey = ai.apiKey;
									if (ai.deepModel) values.aiDeepModel = ai.deepModel;
									if (ai.fastModel) values.aiFastModel = ai.fastModel;
								}
								if (json.sms && typeof json.sms === "object") {
									setSmsExpanded(true);
									const s = json.sms as Record<string, unknown>;
									if (s.provider) values.smsProvider = s.provider;
									if (s.accessKeyId) values.smsAccessKeyId = s.accessKeyId;
									if (s.accessKeySecret)
										values.smsAccessKeySecret = s.accessKeySecret;
									if (s.signName) values.smsSignName = s.signName;
									if (s.templateCode) values.smsTemplateCode = s.templateCode;
								}
								form.setFieldsValue(values);
							} catch {
								message.error("JSON 格式无效，请检查文件内容");
							}
						}}
					>
						导入 JSON 配置快速填写
					</JsonImportButton>

					<Form
						form={form}
						layout="vertical"
						onFinish={handleSubmit}
						size="large"
						autoComplete="off"
						initialValues={{
							siteName: "FSDX CMS",
							smtpPort: 587,
							smtpSecure: false,
						}}
					>
						<AutofillBlocker />
						<Divider>管理员账号</Divider>

						<Form.Item
							name="username"
							rules={[{ required: true, message: "请输入超级管理员用户名" }]}
						>
							<Input prefix={<UserOutlined />} placeholder="超级管理员用户名" />
						</Form.Item>

						<Form.Item
							name="email"
							rules={[{ required: true, message: "请输入邮箱" }]}
						>
							<Input
								prefix={<MailOutlined />}
								placeholder="admin@example.com"
							/>
						</Form.Item>

						<Form.Item
							name="password"
							rules={[{ required: true, message: "请输入密码" }]}
						>
							<Input.Password
								prefix={<LockOutlined />}
								placeholder="密码（至少 6 位）"
							/>
						</Form.Item>

						<Form.Item
							name="confirmPassword"
							rules={[{ required: true, message: "请确认密码" }]}
						>
							<Input.Password
								prefix={<LockOutlined />}
								placeholder="再次输入密码"
							/>
						</Form.Item>

						<Divider>站点设置</Divider>

						<Form.Item name="siteName">
							<Input placeholder="站点名称" />
						</Form.Item>

						<Divider>
							<Button
								type="link"
								onClick={() => setSmtpExpanded(!smtpExpanded)}
								className="mb-2 p-0"
							>
								SMTP 邮件配置（可选，推荐填写）
								{smtpExpanded ? <UpOutlined /> : <DownOutlined />}
							</Button>
						</Divider>

						{smtpExpanded && (
							<>
								<Form.Item name="smtpHost">
									<Input placeholder="SMTP 服务器地址，如 smtp.example.com" />
								</Form.Item>
								<Space.Compact block>
									<Form.Item name="smtpPort" className="w-36">
										<InputNumber
											min={1}
											max={65535}
											placeholder="端口"
											className="w-full"
										/>
									</Form.Item>
									<Form.Item
										name="smtpSecure"
										className="flex-1"
										valuePropName="checked"
									>
										<Space align="center" className="h-full px-3">
											<Switch />
											<span className="text-sm text-muted-foreground">
												SSL/TLS
											</span>
										</Space>
									</Form.Item>
								</Space.Compact>
								<Form.Item name="smtpUser">
									<Input placeholder="SMTP 认证用户名" />
								</Form.Item>
								<Form.Item name="smtpPass">
									<Input.Password placeholder="SMTP 认证密码" />
								</Form.Item>
								<Form.Item name="smtpFrom">
									<Input placeholder="发件人邮箱，如 noreply@example.com" />
								</Form.Item>
							</>
						)}

						<Divider>
							<Button
								type="link"
								onClick={() => setAiExpanded(!aiExpanded)}
								className="mb-2 p-0"
							>
								AI 接入配置（可选）
								{aiExpanded ? <UpOutlined /> : <DownOutlined />}
							</Button>
						</Divider>

						{aiExpanded && (
							<>
								<Form.Item name="aiBaseUrl">
									<Input
										prefix={<RobotOutlined />}
										placeholder="API 基础地址，如 https://api.openai.com/v1"
									/>
								</Form.Item>
								<Form.Item name="aiApiKey">
									<Input.Password
										prefix={<RobotOutlined />}
										placeholder="API 密钥"
									/>
								</Form.Item>
								<Form.Item name="aiDeepModel">
									<Input placeholder="深度思考模型，如 gpt-4o" />
								</Form.Item>
								<Form.Item name="aiFastModel">
									<Input placeholder="快速模型，如 gpt-4o-mini" />
								</Form.Item>
							</>
						)}

						<Divider>
							<Button
								type="link"
								onClick={() => setSmsExpanded(!smsExpanded)}
								className="mb-2 p-0"
							>
								短信配置（可选，用于发送验证码）
								{smsExpanded ? <UpOutlined /> : <DownOutlined />}
							</Button>
						</Divider>

						{smsExpanded && (
							<>
								<Form.Item name="smsProvider">
									<Input
										prefix={<MessageOutlined />}
										placeholder="服务商标识，当前仅支持 aliyun"
									/>
								</Form.Item>
								<Form.Item name="smsAccessKeyId">
									<Input placeholder="阿里云 AccessKey ID" />
								</Form.Item>
								<Form.Item name="smsAccessKeySecret">
									<Input.Password placeholder="阿里云 AccessKey Secret" />
								</Form.Item>
								<Form.Item name="smsSignName">
									<Input placeholder="短信签名（需在阿里云审核通过）" />
								</Form.Item>
								<Form.Item name="smsTemplateCode">
									<Input placeholder="短信模板码，如 SMS_123456789" />
								</Form.Item>
							</>
						)}

						<Form.Item className="mt-4 mb-0">
							<Button
								type="primary"
								htmlType="submit"
								loading={loading}
								block
								size="large"
							>
								开始初始化
							</Button>
						</Form.Item>
					</Form>
				</div>
			</div>
		</div>
	);
}
