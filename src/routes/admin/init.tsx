/**
 * 系统初始化页面：首次部署时创建 root 管理员与基础配置
 */
import {
	CloudUploadOutlined,
	LockOutlined,
	MailOutlined,
	UserOutlined,
} from "@ant-design/icons";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
	Alert,
	theme as antdTheme,
	Button,
	ConfigProvider,
	Divider,
	Form,
	Input,
	InputNumber,
	message,
	Space,
	Switch,
	Upload,
} from "antd";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
	checkInitStatus as checkInitStatusService,
	type InitData,
	initSystem,
} from "#/server/init";

const checkInitStatusFn = createServerFn({ method: "GET" }).handler(
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
		siteName: z.string().default("FSDX CMS"),
		smtpHost: z.string().optional(),
		smtpPort: z.number().int().optional(),
		smtpSecure: z.boolean().optional(),
		smtpUser: z.string().optional(),
		smtpPass: z.string().optional(),
		smtpFrom: z.string().optional(),
	})
	.refine((d) => d.password === d.confirmPassword, {
		message: "两次输入的密码不一致",
		path: ["confirmPassword"],
	});

const init = createServerFn({ method: "POST" })
	.inputValidator(initSchema)
	.handler(async ({ data }) => {
		const smtpProvided = !!(
			data.smtpHost ||
			data.smtpPort ||
			data.smtpUser ||
			data.smtpPass ||
			data.smtpFrom
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
		};

		return initSystem(payload);
	});

export const Route = createFileRoute("/admin/init")({
	beforeLoad: async () => {
		const initialized = await checkInitStatusFn();
		if (initialized) {
			throw redirect({ to: "/admin/login" });
		}
	},
	component: AdminInitPage,
});

/** JSON 导入的数据格式 */
interface ImportJson {
	admin?: {
		username?: string;
		password?: string;
		email?: string;
	};
	siteName?: string;
	smtp?: {
		host?: string;
		port?: number;
		secure?: boolean;
		user?: string;
		pass?: string;
		from?: string;
	};
}

function AdminInitPage() {
	const navigate = useNavigate();
	const [form] = Form.useForm();
	const [loading, setLoading] = useState(false);
	const [smtpExpanded, setSmtpExpanded] = useState(false);

	const [isDark, setIsDark] = useState(false);
	useEffect(() => {
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		setIsDark(mq.matches);
		const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, []);

	// 设置 message 默认 duration 为 5s
	useEffect(() => {
		message.config({ duration: 5 });
	}, []);

	const handleJsonImport = (file: File) => {
		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const json: ImportJson = JSON.parse(e.target?.result as string);
				const values: Record<string, unknown> = {};

				if (json.admin) {
					if (json.admin.username) values.username = json.admin.username;
					if (json.admin.password) {
						values.password = json.admin.password;
						values.confirmPassword = json.admin.password;
					}
					if (json.admin.email) values.email = json.admin.email;
				}
				if (json.siteName) values.siteName = json.siteName;
				if (json.smtp) {
					setSmtpExpanded(true);
					if (json.smtp.host) values.smtpHost = json.smtp.host;
					if (json.smtp.port !== undefined) values.smtpPort = json.smtp.port;
					if (json.smtp.secure !== undefined)
						values.smtpSecure = json.smtp.secure;
					if (json.smtp.user) values.smtpUser = json.smtp.user;
					if (json.smtp.pass) values.smtpPass = json.smtp.pass;
					if (json.smtp.from) values.smtpFrom = json.smtp.from;
				}

				form.setFieldsValue(values);
				message.success("JSON 配置已导入，请核对信息后提交");
			} catch {
				message.error("JSON 解析失败，请检查文件格式");
			}
		};
		reader.readAsText(file);
		return false;
	};

	const handleSubmit = async (values: z.infer<typeof initSchema>) => {
		setLoading(true);
		try {
			const result = await init({ data: values });
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
		<ConfigProvider
			theme={{
				algorithm: isDark
					? antdTheme.darkAlgorithm
					: antdTheme.defaultAlgorithm,
			}}
		>
			<div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
				<div className="w-full max-w-lg">
					<div className="rounded-lg border border-border bg-card p-8 shadow-sm">
						<h1 className="mb-4 text-center text-2xl font-bold">系统初始化</h1>
						<Alert
							message="检测到系统尚未初始化，请创建超级管理员账号并完成基础配置"
							type="info"
							showIcon
							className="mb-4"
						/>

						<Upload
							accept=".json"
							showUploadList={false}
							beforeUpload={handleJsonImport}
							className="mb-4"
						>
							<Button icon={<CloudUploadOutlined />} block>
								导入 JSON 配置快速填写
							</Button>
						</Upload>

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
							<Divider>管理员账号</Divider>

							<Form.Item
								name="username"
								rules={[{ required: true, message: "请输入超级管理员用户名" }]}
							>
								<Input
									prefix={<UserOutlined />}
									placeholder="超级管理员用户名"
								/>
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
								<Input placeholder="FSDX CMS" />
							</Form.Item>

							<Divider>SMTP 邮件配置（可选，推荐填写）</Divider>

							<Button
								type="link"
								onClick={() => setSmtpExpanded(!smtpExpanded)}
								className="mb-2 p-0"
							>
								{smtpExpanded ? "收起 SMTP 配置" : "展开 SMTP 配置"}
							</Button>

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
		</ConfigProvider>
	);
}
