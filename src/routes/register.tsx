/**
 * 客户端用户注册页面（TanStack Form）
 * 集成图片验证码防护，禁用浏览器自动填充
 */

import { useForm } from "@tanstack/react-form";
import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CaptchaInput } from "#/components/client/CaptchaInput";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { useTranslation } from "#/lib/i18n/i18n-context";
import { getCurrentClientFn } from "#/server/client-auth/client-auth.functions";
import { clientRegister } from "#/server/client-auth/client-auth.server";

const registerSchema = z.object({
	username: z.string().min(1, "用户名不能为空").max(50),
	email: z.string().email("邮箱格式不正确"),
	password: z.string().min(6, "密码至少 6 位").max(100),
	captcha: z.string().length(6, "验证码为 6 位"),
});

const clientRegisterFn = createServerFn({ method: "POST" })
	.inputValidator(registerSchema)
	.handler(async ({ data: { username, email, password, captcha } }) => {
		return clientRegister(username, email, password, captcha);
	});

export const Route = createFileRoute("/register")({
	beforeLoad: async () => {
		const user = await getCurrentClientFn();
		if (user) {
			throw redirect({ to: "/" });
		}
	},
	component: ClientRegisterPage,
});

function ClientRegisterPage() {
	const navigate = useNavigate();
	const { t } = useTranslation();

	const form = useForm({
		defaultValues: {
			username: "",
			email: "",
			password: "",
			captcha: "",
			captchaMsg: "",
		},
		onSubmit: async ({ value }) => {
			const result = await clientRegisterFn({
				data: {
					username: value.username,
					email: value.email,
					password: value.password,
					captcha: value.captcha,
				},
			});
			if (!result.success) {
				throw new Error(result.message);
			}
			navigate({ to: "/login" });
		},
	});

	return (
		<main className="flex flex-1 items-center justify-center bg-background px-4 py-8">
			<div className="w-full max-w-sm">
				<Card>
					<CardHeader className="p-4 sm:p-6">
						<CardTitle className="text-center text-xl sm:text-2xl">
							{t("用户注册")}
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
							autoComplete="off"
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
											autoComplete="off"
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
								name="email"
								validators={{
									onChange: ({ value }) => {
										if (!value) return t("请输入邮箱");
										if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
											return t("邮箱格式不正确");
										return undefined;
									},
								}}
							>
								{(field) => (
									<div className="space-y-1.5 sm:space-y-2">
										<label htmlFor={field.name} className="text-sm font-medium">
											{t("邮箱")}
										</label>
										<Input
											id={field.name}
											name={field.name}
											type="email"
											value={field.state.value}
											onBlur={field.handleBlur}
											onChange={(e) => field.handleChange(e.target.value)}
											autoComplete="off"
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

							{/* 邮箱验证码 + 图片验证码弹窗 */}
							<form.Field
								name="captcha"
								validators={{
									onChange: ({ value }) => {
										if (!value) return t("请输入验证码");
										if (value.length !== 6) return t("验证码为 6 位");
										return undefined;
									},
								}}
							>
								{(field) => (
									<div className="space-y-1.5 sm:space-y-2">
										<label htmlFor={field.name} className="text-sm font-medium">
											{t("邮箱验证码")}
										</label>
										<form.Subscribe selector={(state) => state.values.email}>
											{(email) => (
												<CaptchaInput
													email={email}
													value={field.state.value}
													onChange={field.handleChange}
													onMessage={(msg) => {
														form.setFieldValue("captchaMsg", msg);
													}}
												/>
											)}
										</form.Subscribe>
										{field.state.meta.isTouched &&
											field.state.meta.errors.length > 0 && (
												<p className="text-xs text-destructive">
													{field.state.meta.errors.join(", ")}
												</p>
											)}
									</div>
								)}
							</form.Field>

							{/* 验证码发送状态消息 */}
							<form.Subscribe selector={(state) => state.values.captchaMsg}>
								{(captchaMsg) =>
									captchaMsg ? (
										<p className="text-xs text-muted-foreground">
											{captchaMsg}
										</p>
									) : null
								}
							</form.Subscribe>

							<form.Field
								name="password"
								validators={{
									onChange: ({ value }) => {
										if (!value) return t("请输入密码");
										if (value.length < 6) return t("密码至少 6 位");
										return undefined;
									},
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
											autoComplete="new-password"
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
										{isSubmitting ? t("注册中") : t("注册")}
									</Button>
								)}
							</form.Subscribe>
						</form>

						<p className="mt-3 text-center text-sm text-muted-foreground sm:mt-4">
							{t("已有账号？")}{" "}
							<Link
								to="/login"
								className="underline underline-offset-4 hover:text-foreground"
							>
								{t("立即登录")}
							</Link>
						</p>
					</CardContent>
				</Card>
			</div>
		</main>
	);
}
