/**
 * 管理端页面头部组件：统一标题 + 描述 + 操作插槽
 */
import type { ReactNode } from "react";

interface PageHeaderProps {
	title: string;
	description?: string;
	extra?: ReactNode;
}

export function PageHeader({ title, description, extra }: PageHeaderProps) {
	return (
		<div className="mb-6 flex flex-wrap items-start justify-between gap-4">
			<div>
				<h1 className="text-2xl font-bold text-foreground">{title}</h1>
				{description && (
					<p className="mt-1 text-sm text-muted-foreground">{description}</p>
				)}
			</div>
			{extra && <div className="flex items-center gap-2">{extra}</div>}
		</div>
	);
}
