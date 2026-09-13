/**
 * SFn 错误处理示例页：演示客户端统一错误提示的分类文案、请求号与全局兜底
 */
import { message } from "@fsdx/ui-spa/antd-static";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Card, Space, Typography } from "antd";
import { AdminPageContent } from "#/components/admin";
import { sfnUnwrap } from "#/utils/sfn-error";
import {
	demoAuthErrorSFn,
	demoBusinessErrorSFn,
	demoInternalErrorSFn,
	demoSuccessSFn,
	demoValidationErrorSFn,
} from "./-mods/error-handling.functions";

const { Paragraph, Text } = Typography;

export const Route = createFileRoute("/admin/_admin/demo/error-handling")({
	component: ErrorHandlingDemoPage,
});

function ErrorHandlingDemoPage() {
	/** 静默失败：不弹提示，仅 console.warn 诊断 */
	const triggerSilent = () =>
		sfnUnwrap(demoInternalErrorSFn(), { silent: true });

	/** 未捕获：刻意不经 helper 裸调，触发全局 unhandledrejection 兜底 */
	const triggerUncaught = () => {
		void demoInternalErrorSFn();
	};

	/** 成功对照：成功提示由各端自行处理 */
	const triggerSuccess = async () => {
		const [, err] = await sfnUnwrap(demoSuccessSFn());
		if (!err) message.success("调用成功");
	};

	const scenarios = [
		{
			title: "业务错误",
			desc: "服务端抛中文业务文案，客户端按 business 分类提示原文",
			action: () => sfnUnwrap(demoBusinessErrorSFn()),
		},
		{
			title: "参数校验失败",
			desc: "传入 count=0，服务端 validator 拒绝，提示「参数校验失败：数量至少为 1」",
			action: () => sfnUnwrap(demoValidationErrorSFn({ data: { count: 0 } })),
		},
		{
			title: "系统错误",
			desc: "服务端技术错误，客户端显示统一「系统错误」标题，点击「详情」查看请求号 / SFn",
			action: () => sfnUnwrap(demoInternalErrorSFn()),
		},
		{
			title: "权限不足",
			desc: "服务端抛 AdminAuthError，按 auth 分类提示（不追加请求号）",
			action: () => sfnUnwrap(demoAuthErrorSFn()),
		},
		{
			title: "静默失败",
			desc: "silent: true，不弹提示，仅控制台 warn（含 sfnId / requestId）",
			action: triggerSilent,
		},
		{
			title: "成功对照",
			desc: "正常返回，成功提示由调用方自行处理",
			action: triggerSuccess,
		},
		{
			title: "未捕获 → 全局兜底",
			desc: "裸调 SFn 不做任何处理，由全局 unhandledrejection 兜底提示（演示「不漏」）",
			action: triggerUncaught,
		},
	];

	return (
		<AdminPageContent
			title="SFn 错误处理示例"
			description="演示客户端统一错误提示：分类文案、请求号与全局兜底"
		>
			<Space direction="vertical" size={12} style={{ width: "100%" }}>
				<Paragraph type="secondary" style={{ margin: 0 }}>
					点击「触发」按钮观察 antd message 的统一提示；系统错误显示为可读标题，
					点击「详情」查看请求号 / SFn 方法名。控制台可见诊断日志{" "}
					<Text code>[SFn] 方法名 message</Text>。
				</Paragraph>
				{scenarios.map((scenario) => (
					<Card key={scenario.title} size="small">
						<Space
							style={{ width: "100%", justifyContent: "space-between" }}
							align="center"
						>
							<Space direction="vertical" size={2}>
								<Text strong>{scenario.title}</Text>
								<Text type="secondary" style={{ fontSize: 12 }}>
									{scenario.desc}
								</Text>
							</Space>
							<Button onClick={() => void scenario.action()}>触发</Button>
						</Space>
					</Card>
				))}
			</Space>
		</AdminPageContent>
	);
}
