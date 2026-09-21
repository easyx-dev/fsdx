/**
 * 表格操作列统一容器组件
 * 所有表格的操作列通过此组件包裹，规范化 UI 和交互行为
 *
 * 子组件：
 * - TableOperate.Edit：编辑按钮（图标 + "编辑"）
 * - TableOperate.Delete：删除按钮（内置 Popconfirm + 危险按钮，图标 + "删除"）
 * - TableOperate.Link：路由跳转按钮（<Link> 包裹）
 * - TableOperate.Custom：自定义操作扩展入口
 *
 * 上下架、排序等「通用态」不进操作列，直接在单元格内修改（见 inline-cells）。
 * 禁用语义：传 disabledReason 即置灰并用 Tooltip 说明原因（无权限场景统一走这里）。
 * 注意 antd 的 disabled 按钮不派发鼠标事件，Tooltip 必须包在 span 外层才可见。
 */
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { Link } from "@tanstack/react-router";
import { Button, Popconfirm, Space, Tooltip } from "antd";
import type { ReactNode } from "react";
import { useState } from "react";

/** 禁用说明包装：disabled 元素不触发鼠标事件，需用 span 承接 Tooltip */
function withDisabledReason(
	node: ReactNode,
	disabled?: boolean,
	disabledReason?: string,
): ReactNode {
	if (!disabled || !disabledReason) return node;
	return (
		<Tooltip title={disabledReason}>
			<span className="inline-flex">{node}</span>
		</Tooltip>
	);
}

/** Edit 子组件 Props */
interface EditProps {
	onClick: () => void;
	disabled?: boolean;
	/** 置灰原因（无权限等），传入即展示 Tooltip */
	disabledReason?: string;
}

/** Delete 子组件 Props */
interface DeleteProps {
	/**
	 * 删除执行体；失败时直接向上抛出，由调用方的 callSfn / sfnUnwrap 统一提示，
	 * 本组件不自行吞错提示（避免重复提示与原文案泄漏）
	 */
	onConfirm: () => void | Promise<void>;
	/** 确认文案中的实体名称，如 "此角色"、"此管理员" */
	recordName?: string;
	disabled?: boolean;
	disabledReason?: string;
}

/** Link 子组件 Props */
interface LinkProps {
	to: string;
	params?: Record<string, string>;
	icon?: ReactNode;
	children?: ReactNode;
	disabled?: boolean;
	disabledReason?: string;
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
function Edit({ onClick, disabled, disabledReason }: EditProps) {
	return withDisabledReason(
		<Button
			type="link"
			size="small"
			icon={<EditOutlined />}
			onClick={onClick}
			disabled={disabled}
		>
			编辑
		</Button>,
		disabled,
		disabledReason,
	);
}

/** 删除按钮（内置 Popconfirm 确认；错误交由调用方统一提示） */
function Delete({
	onConfirm,
	recordName = "记录",
	disabled,
	disabledReason,
}: DeleteProps) {
	const [loading, setLoading] = useState(false);

	const handleConfirm = async () => {
		const result = onConfirm();
		if (!(result instanceof Promise)) return;
		setLoading(true);
		try {
			await result;
		} finally {
			setLoading(false);
		}
	};

	return withDisabledReason(
		<Popconfirm
			title={`确定删除${recordName}？`}
			onConfirm={handleConfirm}
			okButtonProps={{ loading }}
			disabled={disabled}
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
		</Popconfirm>,
		disabled,
		disabledReason,
	);
}

/** 路由跳转按钮（<Link> 包裹） */
function OperateLink({
	to,
	params,
	icon = <EditOutlined />,
	children = "编辑",
	disabled,
	disabledReason,
}: LinkProps) {
	return withDisabledReason(
		<Link to={to} params={params}>
			<Button type="link" size="small" icon={icon} disabled={disabled}>
				{children}
			</Button>
		</Link>,
		disabled,
		disabledReason,
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

export { TableOperate, withDisabledReason };
