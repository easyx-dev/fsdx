/**
 * 管理员登录页面
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import { useState } from "react";
import { z } from "zod";
import { COOKIE_NAMES } from "#/lib/jwt";
import { adminLoginService } from "#/server/auth";

const loginSchema = z.object({
	username: z.string().min(1, "用户名不能为空").max(50),
	password: z.string().min(1, "密码不能为空").max(100),
});

/** 管理员登录 SF */
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
				maxAge: 7 * 24 * 3600, // 7 天
			});
		}
		return result;
	});

export const Route = createFileRoute("/admin/login")({
	component: AdminLoginPage,
});

function AdminLoginPage() {
	const navigate = useNavigate();
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			const result = await adminLogin({ data: { username, password } });
			if (!result.success) {
				setError(result.message || "登录失败");
				return;
			}
			navigate({ to: "/admin" });
		} catch (err) {
			const errorMessage =
				err instanceof Error ? err.message : "网络错误，请稍后重试";
			console.error("[登录失败]", err);
			setError(errorMessage);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-zinc-50">
			<div className="w-full max-w-sm">
				<div className="rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
					<h1 className="mb-6 text-center text-2xl font-bold text-zinc-900">
						管理后台登录
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
							/>
						</div>

						<button
							type="submit"
							disabled={loading}
							className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
						>
							{loading ? "登录中..." : "登录"}
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}
