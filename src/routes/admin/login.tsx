/**
 * 管理员登录页面（antd）
 */
import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import {
	App,
	theme as antdTheme,
	Button,
	ConfigProvider,
	Form,
	Input,
} from "antd";
import { useEffect, useState } from "react";
import { z } from "zod";
import { COOKIE_NAMES } from "#/lib/jwt";
import { adminLoginService } from "#/server/auth";

const loginSchema = z.object({
	username: z.string().min(1, "用户名不能为空").max(50),
	password: z.string().min(1, "密码不能为空").max(100),
});

const adminLogin = createServerFn({ method: "POST" })
	.inputValidator(loginSchema)
	.handler(async ({ data: { username, password } }) => {
		const result = await adminLoginService(username, password);
		if (result.success && result.token) {
			setCookie(COOKIE_NAMES.ACCESS_TOKEN, result.token, {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "lax",
				path: "/",
				maxAge: 7 * 24 * 3600,
			});
		}
		return result;
	});

export const Route = createFileRoute("/admin/login")({
	component: AdminLoginPage,
});

function AdminLoginPage() {
	const navigate = useNavigate();
	const [form] = Form.useForm();
	const { message } = App.useApp();
	const [loading, setLoading] = useState(false);

	// 同步 antd 主题跟随系统 + 手动切换
	const [isDark, setIsDark] = useState(false);
	useEffect(() => {
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		setIsDark(mq.matches);
		const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, []);

	const handleSubmit = async (values: {
		username: string;
		password: string;
	}) => {
		setLoading(true);
		try {
			const result = await adminLogin({ data: values });
			if (!result.success) {
				message.error(result.message || "登录失败");
				return;
			}
			navigate({ to: "/admin" });
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
			<App>
				<div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
					<div className="w-full max-w-sm">
						<div className="rounded-lg border border-border bg-card p-8 shadow-sm">
							<h1 className="mb-6 text-center text-2xl font-bold">
								管理后台登录
							</h1>
							<Form
								form={form}
								onFinish={handleSubmit}
								size="large"
								autoComplete="off"
							>
								<Form.Item
									name="username"
									rules={[{ required: true, message: "请输入用户名" }]}
								>
									<Input prefix={<UserOutlined />} placeholder="用户名" />
								</Form.Item>
								<Form.Item
									name="password"
									rules={[{ required: true, message: "请输入密码" }]}
								>
									<Input.Password
										prefix={<LockOutlined />}
										placeholder="密码"
									/>
								</Form.Item>
								<Form.Item>
									<Button
										type="primary"
										htmlType="submit"
										loading={loading}
										block
									>
										登录
									</Button>
								</Form.Item>
							</Form>
						</div>
					</div>
				</div>
			</App>
		</ConfigProvider>
	);
}
