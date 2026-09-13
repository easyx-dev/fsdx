/**
 * SFn 错误处理示例页（前台）：演示统一错误提示的分类文案、请求号与全局兜底
 */
import {
	Button,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@fsdx/ui-ssr/ui";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useTranslation } from "#/components/providers";
import { sfnUnwrap } from "#/utils/sfn-error";
import {
	clientDemoAuthErrorSFn,
	clientDemoBusinessErrorSFn,
	clientDemoInternalErrorSFn,
	clientDemoSuccessSFn,
	clientDemoValidationErrorSFn,
} from "./-mods/error-handling.functions";

export const Route = createFileRoute("/demo/error-handling")({
	component: ErrorHandlingDemoPage,
});

function ErrorHandlingDemoPage() {
	const { t } = useTranslation();

	/** 静默失败：不弹提示，仅 console.warn 诊断 */
	const triggerSilent = () =>
		sfnUnwrap(clientDemoInternalErrorSFn(), { silent: true });

	/** 未捕获：刻意不经 helper 裸调，触发全局 unhandledrejection 兜底 */
	const triggerUncaught = () => {
		void clientDemoInternalErrorSFn();
	};

	/** 成功对照：成功提示由调用方自行处理 */
	const triggerSuccess = async () => {
		const [, err] = await sfnUnwrap(clientDemoSuccessSFn());
		if (!err) toast.success(t("调用成功"));
	};

	const scenarios = [
		{
			title: t("业务错误"),
			desc: t("服务端抛中文业务文案，客户端按 business 分类提示原文"),
			action: () => sfnUnwrap(clientDemoBusinessErrorSFn()),
		},
		{
			title: t("参数校验失败"),
			desc: t(
				"传入 count=0，服务端 validator 拒绝，提示「参数校验失败：数量至少为 1」",
			),
			action: () =>
				sfnUnwrap(clientDemoValidationErrorSFn({ data: { count: 0 } })),
		},
		{
			title: t("系统错误"),
			desc: t(
				"服务端技术错误，客户端显示统一「系统错误」标题，点击「详情」查看请求号 / SFn",
			),
			action: () => sfnUnwrap(clientDemoInternalErrorSFn()),
		},
		{
			title: t("权限不足 / 未登录"),
			desc: t("服务端抛 ClientAuthError，按 auth 分类提示（不追加请求号）"),
			action: () => sfnUnwrap(clientDemoAuthErrorSFn()),
		},
		{
			title: t("静默失败"),
			desc: t("silent: true，不弹提示，仅控制台 warn（含 sfnId / requestId）"),
			action: triggerSilent,
		},
		{
			title: t("成功对照"),
			desc: t("正常返回，成功提示由调用方自行处理"),
			action: triggerSuccess,
		},
		{
			title: t("未捕获 → 全局兜底"),
			desc: t(
				"裸调 SFn 不做处理，由全局 unhandledrejection 兜底提示（演示「不漏」）",
			),
			action: triggerUncaught,
		},
	];

	return (
		<main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
			<Card>
				<CardHeader className="p-4 sm:p-6">
					<CardTitle className="text-xl sm:text-2xl">
						{t("SFn 错误处理示例")}
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
					<p className="text-sm leading-6 text-muted-foreground">
						{t(
							"点击「触发」观察 sonner toast 的统一提示；系统错误显示为可读标题，点击「详情」查看请求号 / SFn 方法名。控制台可见诊断日志 [SFn] 方法名 message。",
						)}
					</p>
					<div className="grid gap-3">
						{scenarios.map((scenario) => (
							<div
								key={scenario.title}
								className="flex items-start justify-between gap-4 rounded-md border border-border p-3"
							>
								<div className="space-y-1">
									<p className="text-sm font-medium text-foreground">
										{scenario.title}
									</p>
									<p className="text-xs text-muted-foreground">
										{scenario.desc}
									</p>
								</div>
								<Button
									variant="outline"
									size="sm"
									onClick={() => void scenario.action()}
								>
									{t("触发")}
								</Button>
							</div>
						))}
					</div>
				</CardContent>
			</Card>
		</main>
	);
}
