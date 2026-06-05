/**
 * 错误边界组件：提供路由级异常的友好展示与完整日志记录
 * 不依赖 AuthProvider 等全局 Context，确保错误边界自身渲染稳定
 */

import type {
	ErrorComponentProps,
	NotFoundRouteProps,
} from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Home, RefreshCw } from "lucide-react";

/** 输出错误日志，服务端和客户端均不影响异常展示 */
function logError(error: unknown, context?: Record<string, unknown>) {
	try {
		const serializable = {
			name: error instanceof Error ? error.name : "UnknownError",
			message: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			...context,
			timestamp: new Date().toISOString(),
			isServer: typeof window === "undefined",
		};
		console.error("[ERROR BOUNDARY]", serializable);
	} catch {
		// 确保日志自身异常不中断错误边界
	}
}

/**
 * 默认错误回退组件
 * 用于 router.defaultErrorComponent 和各路由 errorComponent
 */
export function DefaultErrorFallback({
	error,
	reset,
	info,
}: ErrorComponentProps) {
	logError(error, { componentStack: info?.componentStack });

	const message = error instanceof Error ? error.message : "未知错误";

	return (
		<main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
			<div className="w-full max-w-md text-center">
				<div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
					<AlertTriangle className="h-8 w-8 text-red-600" />
				</div>
				<h1 className="mb-2 text-2xl font-bold text-zinc-900">页面出错了</h1>
				{message && (
					<p className="mb-6 text-sm text-zinc-500 break-all">{message}</p>
				)}
				<div className="flex items-center justify-center gap-3">
					{reset && (
						<button
							type="button"
							onClick={reset}
							className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
						>
							<RefreshCw size={14} />
							重试
						</button>
					)}
					<Link
						to="/"
						className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
					>
						<Home size={14} />
						返回首页
					</Link>
				</div>
			</div>
		</main>
	);
}

/**
 * 404 回退组件
 * 用于 router.defaultNotFoundComponent
 */
export function NotFoundFallback({ routeId, data: _data }: NotFoundRouteProps) {
	logError(new Error(`页面未找到: ${routeId}`), { routeId });

	return (
		<main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
			<div className="w-full max-w-md text-center">
				<div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100">
					<AlertTriangle className="h-8 w-8 text-zinc-400" />
				</div>
				<h1 className="mb-2 text-2xl font-bold text-zinc-900">404</h1>
				<p className="mb-6 text-sm text-zinc-500">页面未找到</p>
				<div className="flex items-center justify-center gap-3">
					<button
						type="button"
						onClick={() => window.history.back()}
						className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
					>
						<ArrowLeft size={14} />
						返回上页
					</button>
					<Link
						to="/"
						className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
					>
						<Home size={14} />
						返回首页
					</Link>
				</div>
			</div>
		</main>
	);
}
