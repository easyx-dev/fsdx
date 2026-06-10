/**
 * 客户端用户登录页面（TanStack Form）
 */

import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { useTranslation } from "#/lib/i18n/i18n-context";
import { COOKIE_NAMES } from "#/lib/jwt/jwt";
import { clientLogin } from "#/server/client-auth/client-auth.server";

const loginSchema = z.object({
	username: z.string().min(1, "用户名不能为空").max(50),
	password: z.string().min(1, "密码不能为空").max(100),
});

const clientLoginFn = createServerFn({ method: "POST" })
	.inputValidator(loginSchema)
	.handler(async ({ data: { username, password } }) => {
		const result = await clientLogin(username, password);
		if (result.success && result.token) {
			setCookie(COOKIE_NAMES.CLIENT_TOKEN, result.token, {
				httpOnly: true,
				secure: process.env.NODE_ENV === "production",
				sameSite: "lax",
				path: "/",
				maxAge: 7 * 24 * 3600,
			});
		}
		return result;
	});

export const Route = createFileRoute("/login")({
	component: ClientLoginPage,
});

function ClientLoginPage() {
	const navigate = useNavigate();
	const { t } = useTranslation();

	const form = useForm({
		defaultValues: {
			username: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			const result = await clientLoginFn({ data: value });
			if (!result.success) {
				throw new Error(result.message || t("登录失败"));
			}
			navigate({ to: "/" });
		},
	});

	return (
		<main className="flex flex-1 items-center justify-center bg-background px-4 py-8">
			<div className="w-full max-w-sm">
				<Card>
					<CardHeader className="p-4 sm:p-6">
						<CardTitle className="text-center text-xl sm:text-2xl">
							{t("用户登录")}
						</CardTitle>
					</CardHeader>
					<CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
						<form
							onSubmit={(e) => {
								e.preventDefault();
								e.stopPropagation();
								form.handleSubmit();
							}}
							className="space-y-3 sm:space-y-4"
						>
							<form.Field
								name="username"
								validators={{
									onChange: ({ value }) =>
										!value ? t("请输入用户名") : undefined,
								}}
							>
								{(field) => (
									<div className="space-y-1.5 sm:space-y-2">
										<label htmlFor={field.name} className="text-sm font-medium">
											{t("用户名")}
										</label>
										<Input
											id={field.name}
											name={field.name}
											type="text"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											autoFocus
										/>
										{field.state.meta.isTouched &&
											field.state.meta.errors.length > 0 && (
												<p className="text-xs text-destructive">
													{field.state.meta.errors.join(", ")}
												</p>
											)}
									</div>
								)}
							</form.Field>

							<form.Field
								name="password"
								validators={{
									onChange: ({ value }) =>
										!value ? t("请输入密码") : undefined,
								}}
							>
								{(field) => (
									<div className="space-y-1.5 sm:space-y-2">
										<label htmlFor={field.name} className="text-sm font-medium">
											{t("密码")}
										</label>
										<Input
											id={field.name}
											name={field.name}
											type="password"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
										/>
										{field.state.meta.isTouched &&
											field.state.meta.errors.length > 0 && (
												<p className="text-xs text-destructive">
													{field.state.meta.errors.join(", ")}
												</p>
											)}
									</div>
								)}
							</form.Field>

							{/* 服务端错误展示 */}
							<form.Subscribe selector={(state) => state.errorMap}>
								{(errorMap) =>
									errorMap.onSubmit ? (
										<div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
											{errorMap.onSubmit}
										</div>
									) : null
								}
							</form.Subscribe>

							<form.Subscribe
								selector={(state) => [state.canSubmit, state.isSubmitting]}
							>
								{([canSubmit, isSubmitting]) => (
									<Button
										type="submit"
										disabled={!canSubmit}
										className="w-full"
									>
										{isSubmitting ? t("登录中") : t("登录")}
									</Button>
								)}
							</form.Subscribe>
						</form>

						<p className="mt-3 text-center text-sm text-muted-foreground sm:mt-4">
							{t("还没有账号？")}{" "}
							<Link
								to="/register"
								className="underline underline-offset-4 hover:text-foreground"
							>
								{t("立即注册")}
							</Link>
						</p>
					</CardContent>
				</Card>
			</div>
		</main>
	);
}
