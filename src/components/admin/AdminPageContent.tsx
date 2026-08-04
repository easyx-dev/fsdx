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
			{/* 吸顶标题栏 */}
			<div className="sticky top-0 z-10 flex h-14 shrink-0 items-center border-b border-border bg-background px-5">
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
			{/* 内容区 */}
			<div className="flex-1 overflow-auto p-5">{children}</div>
		</div>
	);
}
