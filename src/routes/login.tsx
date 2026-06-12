/**
 * 客户端用户登录页面（TanStack Form）
 */

import { useForm } from "@tanstack/react-form";
import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { useTranslation } from "#/lib/i18n/i18n-context";
import { COOKIE_NAMES } from "#/lib/jwt/jwt";
import { getCurrentClientSFn } from "#/server/client-auth/client-auth.functions";
import { clientLogin } from "#/server/client-auth/client-auth.server";

const loginSchema = z.object({
	username: z.string().min(1, "用户名不能为空").max(50),
	password: z.string().min(1, "密码不能为空").max(100),
});

const clientLoginSFn = createServerFn({ method: "POST" })
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

function LoginError({ error }: { error: unknown }) {
	return (
		<main className="flex flex-1 items-center justify-center bg-background px-4 py-8">
			<p className="text-sm text-destructive">
				{error instanceof Error ? error.message : "加载失败，请稍后重试"}
			</p>
		</main>
	);
}

export const Route = createFileRoute("/login")({
	beforeLoad: async () => {
		const user = await getCurrentClientSFn();
		if (user) {
			throw redirect({ to: "/" });
		}
	},
	component: ClientLoginPage,
	errorComponent: LoginError,
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
			const result = await clientLoginSFn({ data: value });
			if (!result.success) {
				toast.error(result.message || t("登录失败"));
				return;
			}
			toast.success(t("登录成功"));
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
