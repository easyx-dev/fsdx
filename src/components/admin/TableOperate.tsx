/**
 * 表格操作列统一容器组件
 * 所有表格的操作列通过此组件包裹，规范化 UI 和交互行为
 *
 * 子组件：
 * - TableOperate.Edit：编辑按钮（图标 + "编辑"）
 * - TableOperate.Delete：删除按钮（内置 Popconfirm + 危险按钮，图标 + "删除"）
 * - TableOperate.Link：路由跳转按钮（<Link> 包裹）
 * - TableOperate.Custom：自定义操作扩展入口
 */
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { Link } from "@tanstack/react-router";
import { Button, Popconfirm, Space } from "antd";
import type { ReactNode } from "react";
import { useState } from "react";
import { message } from "#/components/antd-static";

/** Edit 子组件 Props */
interface EditProps {
	onClick: () => void;
	disabled?: boolean;
}

/** Delete 子组件 Props */
interface DeleteProps {
	onConfirm: () => void | Promise<void>;
	/** 确认文案中的实体名称，如 "此角色"、"此管理员" */
	recordName?: string;
	disabled?: boolean;
}

/** Link 子组件 Props */
interface LinkProps {
	to: string;
	params?: Record<string, string>;
	icon?: ReactNode;
	children?: ReactNode;
}

/** Custom 子组件 Props */
interface CustomProps {
	children: ReactNode;
}

/** TableOperate 容器 Props */
interface TableOperateProps {
	children: ReactNode;
}

/** 编辑按钮 */
function Edit({ onClick, disabled }: EditProps) {
	return (
		<Button
			type="link"
			size="small"
			icon={<EditOutlined />}
			onClick={onClick}
			disabled={disabled}
		>
			编辑
		</Button>
	);
}

/** 删除按钮（内置 Popconfirm 确认 + 错误处理） */
function Delete({ onConfirm, recordName = "记录", disabled }: DeleteProps) {
	const [loading, setLoading] = useState(false);

	const handleConfirm = async () => {
		const result = onConfirm();
		if (result instanceof Promise) {
			setLoading(true);
			try {
				await result;
			} catch (err) {
				message.error(err instanceof Error ? err.message : "删除失败");
			} finally {
				setLoading(false);
			}
		}
	};

	return (
		<Popconfirm
			title={`确定删除${recordName}？`}
			onConfirm={handleConfirm}
			okButtonProps={{ loading }}
		>
			<Button
				type="link"
				size="small"
				danger
				icon={<DeleteOutlined />}
				disabled={disabled}
			>
				删除
			</Button>
		</Popconfirm>
	);
}

/** 路由跳转按钮（<Link> 包裹） */
function OperateLink({
	to,
	params,
	icon = <EditOutlined />,
	children = "编辑",
}: LinkProps) {
	return (
		<Link to={to} params={params}>
			<Button type="link" size="small" icon={icon}>
				{children}
			</Button>
		</Link>
	);
}

/** 自定义操作占位组件，透传任意内容 */
function Custom({ children }: CustomProps) {
	return <>{children}</>;
}

/** 表格操作列统一容器 */
function TableOperate({ children }: TableOperateProps) {
	return <Space size={4}>{children}</Space>;
}

TableOperate.Edit = Edit;
TableOperate.Delete = Delete;
TableOperate.Link = OperateLink;
TableOperate.Custom = Custom;

export { TableOperate };
