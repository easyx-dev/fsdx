/**
 * ProTable：基于 antd Table 的增强表格组件
 * 默认开启 bordered，扩展 ellipsis 支持自定义 Tooltip，支持 copyable 复制
 */
import { CopyOutlined } from "@ant-design/icons";
import type { TableProps, TooltipProps } from "antd";
import { Button, Table, Tooltip } from "antd";
import type { ColumnsType, ColumnType } from "antd/es/table";
import { useMemo } from "react";

/** 扩展的 ellipsis 类型：支持自定义 Tooltip */
type ProEllipsis = boolean | { showTitle?: boolean; tooltip?: TooltipProps };

/** 扩展的列类型，新增 copyable 属性 */
export interface ProColumnType<T = any>
	extends Omit<ColumnType<T>, "ellipsis"> {
	/** 超出省略，可传入 Tooltip 属性自定义提示 */
	ellipsis?: ProEllipsis;
	/** 是否显示复制按钮，复制 dataIndex 对应的原始值 */
	copyable?: boolean;
}

export interface ProTableProps<T = any> extends Omit<TableProps<T>, "columns"> {
	columns: ColumnsType<T>;
}

/**
 * 判断 ellipsis 是否为带有自定义 tooltip 的对象
 */
function hasCustomTooltip(
	ellipsis: ProEllipsis | undefined,
): ellipsis is { showTitle?: boolean; tooltip: TooltipProps } {
	return (
		typeof ellipsis === "object" &&
		ellipsis !== null &&
		"tooltip" in ellipsis &&
		ellipsis.tooltip !== undefined
	);
}

/**
 * 将 ProColumn 的处理属性（copyable、自定义 tooltip）转换为原生 antd 列
 */
function processColumns<T extends Record<string, any>>(
	columns: ColumnsType<T>,
): ColumnsType<T> {
	return (columns as ProColumnType<T>[]).map((col) => {
		const { copyable, ellipsis, ...rest } = col as ProColumnType<T>;

		// 原始 render 函数
		const originalRender = (col as ColumnType<T>).render;

		// 计算最终传给 antd 的 ellipsis
		let antdEllipsis: boolean | { showTitle?: boolean } | undefined;
		if (typeof ellipsis === "object" && ellipsis !== null) {
			antdEllipsis = hasCustomTooltip(ellipsis)
				? undefined
				: { showTitle: ellipsis.showTitle };
		} else {
			antdEllipsis = ellipsis;
		}

		const hasCustomTooltipFlag = hasCustomTooltip(ellipsis);
		const hasCopyable = copyable === true;

		// 无需包装，直接返回
		if (!hasCustomTooltipFlag && !hasCopyable) {
			return {
				...rest,
				...((col as ColumnType<T>).render ? { render: originalRender } : {}),
				...(antdEllipsis !== undefined ? { ellipsis: antdEllipsis } : {}),
			} as ColumnType<T>;
		}

		// 包装 render
		return {
			...rest,
			...(antdEllipsis !== undefined ? { ellipsis: antdEllipsis } : {}),
			render: (value: unknown, record: T, index: number) => {
				const displayContent: React.ReactNode = originalRender
					? (originalRender(value, record, index) as React.ReactNode)
					: ((value as React.ReactNode) ?? null);

				// null / undefined 不做包装
				if (displayContent === null || displayContent === undefined) {
					return null;
				}

				const rawValue =
					typeof value === "string" || typeof value === "number"
						? String(value)
						: "";

				let child: React.ReactNode = displayContent;

				// copyable 用 Button 实现复制
				if (hasCopyable && rawValue) {
					child = (
						<span
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: 4,
								maxWidth: "100%",
							}}
						>
							<span
								style={{
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
								}}
							>
								{displayContent}
							</span>
							<Button
								type="text"
								size="small"
								icon={<CopyOutlined />}
								onClick={(e) => {
									e.stopPropagation();
									navigator.clipboard.writeText(rawValue).catch(() => {
										// 复制失败静默处理
									});
								}}
							/>
						</span>
					);
				}

				// 自定义 Tooltip
				if (hasCustomTooltipFlag) {
					const tooltipTitle =
						(ellipsis as { tooltip: TooltipProps }).tooltip.title ?? rawValue;
					child = (
						<Tooltip
							{...(ellipsis as { tooltip: TooltipProps }).tooltip}
							title={tooltipTitle}
						>
							{typeof child === "string" || typeof child === "number" ? (
								<span>{child}</span>
							) : (
								child
							)}
						</Tooltip>
					);
				}

				return child;
			},
		} as ColumnType<T>;
	});
}

/**
 * ProTable 组件：增强的 antd Table
 * - 默认 bordered
 * - ellipsis 支持自定义 Tooltip：{ tooltip: TooltipProps }
 * - copyable 支持列值复制
 */
export function ProTable<T extends Record<string, any>>({
	bordered = true,
	columns,
	...restProps
}: ProTableProps<T>) {
	const processedColumns = useMemo(() => processColumns<T>(columns), [columns]);

	return (
		<Table<T> bordered={bordered} columns={processedColumns} {...restProps} />
	);
}
