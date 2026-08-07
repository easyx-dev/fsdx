/**
 * 管理端页面容器：吸顶标题栏 + 内容区
 * 替代各页面手动编写的标题区域
 */
import type { ReactNode } from "react";

interface AdminPageContentProps {
	title: ReactNode;
	description?: string;
	extra?: ReactNode;
	children: ReactNode;
}

export function AdminPageContent({
	title,
	description,
	extra,
	children,
}: AdminPageContentProps) {
	return (
		<div className="flex flex-1 flex-col overflow-hidden">
			{/* 标题栏：定高，高度由 CSS 变量 --admin-header-height 提供 */}
			<div
				className="z-10 flex shrink-0 items-center border-b border-border bg-background px-5"
				style={{ height: "var(--admin-header-height)" }}
			>
				<div className="flex min-w-0 flex-1 items-center justify-between gap-4">
					<div className="min-w-0">
						<h1 className="text-base font-semibold text-foreground">{title}</h1>
						{description && (
							<p className="mt-0.5 text-xs text-muted-foreground">
								{description}
							</p>
						)}
					</div>
					{extra && (
						<div className="flex shrink-0 items-center gap-2">{extra}</div>
					)}
				</div>
			</div>
			{/* 内容区：高度 = 视口 - 标题栏高，内部滚动，便于子元素按已知高度布局 */}
			<div
				className="overflow-auto p-5"
				style={{ height: "calc(100vh - var(--admin-header-height))" }}
			>
				{children}
			</div>
		</div>
	);
}
