/**
 * 列表页工具条：左筛选 / 右次要操作 的单行容器
 *
 * 统一各页面手写的 `display:flex; gap:12` 与换行策略；主操作（新建等）仍放页面标题栏 extra，
 * 保持「主操作固定可见、筛选跟随内容滚动」的层级。
 */
import { Button } from "antd";
import type { ReactNode } from "react";

interface AdminTableToolbarProps {
	/** 左侧筛选与搜索控件（Segmented / Input.Search / Select / 日期范围等） */
	children: ReactNode;
	/** 右侧次要操作（导出、批量操作等） */
	extra?: ReactNode;
	/** 传入即渲染「重置」按钮（清空筛选条件并回到第一页） */
	onReset?: () => void;
}

export function AdminTableToolbar({
	children,
	extra,
	onReset,
}: AdminTableToolbarProps) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-3">
			<div className="flex flex-wrap items-center gap-3">{children}</div>
			<div className="flex flex-wrap items-center gap-2">
				{extra}
				{onReset && <Button onClick={onReset}>重置</Button>}
			</div>
		</div>
	);
}
