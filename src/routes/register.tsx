/**
 * 客户端用户注册页面
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { clientRegisterService } from "#/server/auth/client";
import { sendCaptcha } from "#/server/captcha";

const registerSchema = z.object({
	username: z.string().min(1, "用户名不能为空").max(50),
	email: z.string().email("邮箱格式不正确"),
	password: z.string().min(6, "密码至少 6 位").max(100),
	captcha: z.string().length(6, "验证码为 6 位"),
});

const sendCaptchaSchema = z.object({
	email: z.string().email("邮箱格式不正确"),
});

/** 客户端注册 SF */
const clientRegister = createServerFn({ method: "POST" })
	.inputValidator(registerSchema)
	.handler(async ({ data: { username, email, password, captcha } }) => {
		return clientRegisterService(username, email, password, captcha);
	});

/** 发送验证码 SF */
const sendCaptchaFn = createServerFn({ method: "POST" })
	.inputValidator(sendCaptchaSchema)
	.handler(async ({ data: { email } }) => {
		return sendCaptcha("email", email);
	});

export const Route = createFileRoute("/register")({
	component: ClientRegisterPage,
});

function ClientRegisterPage() {
	const navigate = useNavigate();
	const [username, setUsername] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [captcha, setCaptcha] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [sendingCaptcha, setSendingCaptcha] = useState(false);
	const [captchaMsg, setCaptchaMsg] = useState("");

	const handleSendCaptcha = async () => {
		if (!email) {
			setCaptchaMsg("请先输入邮箱");
			return;
		}
		setSendingCaptcha(true);
		setCaptchaMsg("");
		try {
			const result = await sendCaptchaFn({ data: { email } });
			setCaptchaMsg(result.message);
		} catch {
			setCaptchaMsg("发送失败");
		} finally {
			setSendingCaptcha(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			const result = await clientRegister({
				data: { username, email, password, captcha },
			});
			if (!result.success) {
				setError(result.message);
				return;
			}
			navigate({ to: "/login" });
		} catch {
			setError("网络错误，请稍后重试");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-zinc-50">
			<div className="w-full max-w-sm">
				<div className="rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
					<h1 className="mb-6 text-center text-2xl font-bold text-zinc-900">
						用户注册
					</h1>

					{error && (
						<div className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
							{error}
						</div>
					)}

					<form onSubmit={handleSubmit} className="space-y-4">
						<div>
							<label
								htmlFor="username"
								className="mb-1 block text-sm font-medium text-zinc-700"
							>
								用户名
							</label>
							<input
								id="username"
								type="text"
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
								required
								autoFocus
							/>
						</div>

						<div>
							<label
								htmlFor="email"
								className="mb-1 block text-sm font-medium text-zinc-700"
							>
								邮箱
							</label>
							<div className="flex gap-2">
								<input
									id="email"
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
									required
								/>
								<button
									type="button"
									onClick={handleSendCaptcha}
									disabled={sendingCaptcha}
									className="rounded-md bg-zinc-100 px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-200 disabled:opacity-50 whitespace-nowrap"
								>
									{sendingCaptcha ? "发送中..." : "获取验证码"}
								</button>
							</div>
							{captchaMsg && (
								<p className="mt-1 text-xs text-zinc-500">{captchaMsg}</p>
							)}
						</div>

						<div>
							<label
								htmlFor="captcha"
								className="mb-1 block text-sm font-medium text-zinc-700"
							>
								验证码
							</label>
							<input
								id="captcha"
								type="text"
								value={captcha}
								onChange={(e) => setCaptcha(e.target.value)}
								maxLength={6}
								className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
								required
								placeholder="6 位数字验证码"
							/>
						</div>

						<div>
							<label
								htmlFor="password"
								className="mb-1 block text-sm font-medium text-zinc-700"
							>
								密码
							</label>
							<input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
								required
								minLength={6}
							/>
						</div>

						<button
							type="submit"
							disabled={loading}
							className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
						>
							{loading ? "注册中..." : "注册"}
						</button>
					</form>

					<p className="mt-4 text-center text-sm text-zinc-500">
						已有账号？{" "}
						<Link to="/login" className="text-zinc-900 underline">
							立即登录
						</Link>
					</p>
				</div>
			</div>
		</div>
	);
}
