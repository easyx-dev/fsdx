/**
 * ProTable：基于 antd Table 的增强表格组件
 * 默认开启 bordered，支持 valueType 自动渲染、renderText 自定义文本、
 * renderCopyableText 自定义复制、ellipsis Tooltip、copyable 复制
 * 表体高度可继承就近页面骨架注入的剩余空间（见 table-height）
 */
import { CopyOutlined } from "@ant-design/icons";
import type { TableProps, TooltipProps } from "antd";
import { Button, Table, Tooltip } from "antd";
import type { ColumnsType, ColumnType } from "antd/es/table";
import dayjs from "dayjs";
import { useMemo } from "react";
import { copyText } from "../clipboard";
import { useTableHeight } from "./table-height";

/** 扩展的 ellipsis 类型：支持 boolean 和自定义 Tooltip */
type ProEllipsis = boolean | { showTitle?: boolean; tooltip?: TooltipProps };

/** 扩展的列类型 */
export interface ProColumnType<T = unknown>
	extends Omit<ColumnType<T>, "ellipsis"> {
	/** 超出省略，可传入 Tooltip 属性自定义提示 */
	ellipsis?: ProEllipsis;
	/** 是否显示复制按钮，复制 dataIndex 对应的原始值 */
	copyable?: boolean;
	/**
	 * 值类型：text 直接展示，dateTime 格式化为 YYYY-MM-DD HH:mm:ss，
	 * dateTimeMinute 格式化为 YYYY-MM-DD HH:mm
	 */
	valueType?: "text" | "dateTime" | "dateTimeMinute";
	/**
	 * 空值占位内容：渲染结果为空（null / undefined / 空字符串）时展示
	 * 常用于可为空的时间列（如「过期时间」「最后登录」）与可选文本列，避免各页重复兜底
	 */
	emptyText?: React.ReactNode;
	/** 自定义文本渲染，必须返回 string；启用后 ellipsis 的 Tooltip 以此值为标题 */
	renderText?: (value: unknown, record: T, index: number) => string;
	/** 自定义复制文本，存在时复制此返回值；复制成功后提示"已复制" */
	renderCopyableText?: (value: unknown, record: T, index: number) => string;
}

export interface ProTableProps<T = unknown>
	extends Omit<TableProps<T>, "columns"> {
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
 * 根据 valueType 自动渲染值
 */
function renderByValueType(
	valueType: "text" | "dateTime" | "dateTimeMinute",
	value: unknown,
): string | null {
	if (value === null || value === undefined) return null;
	switch (valueType) {
		case "dateTime":
			return dayjs(value as string | number | Date).format(
				"YYYY-MM-DD HH:mm:ss",
			);
		case "dateTimeMinute":
			return dayjs(value as string | number | Date).format("YYYY-MM-DD HH:mm");
		default:
			return String(value);
	}
}

/**
 * 时间值的统一格式化（与列 `valueType` 同一实现）
 * 供行展开面板、详情弹层等非表格场景复用，避免各页再手写 `dayjs().format`
 */
export function formatDateTimeValue(
	value: unknown,
	type: "dateTime" | "dateTimeMinute" = "dateTimeMinute",
): string | null {
	return renderByValueType(type, value);
}

/**
 * 将 ProColumn 的处理属性转为原生 antd 列
 * 行记录类型不收窄：字段假设由调用方的列定义与泛型负责，组件内部只做透传
 */
function processColumns<T>(columns: ColumnsType<T>): ColumnsType<T> {
	return (columns as ProColumnType<T>[]).map((col) => {
		const {
			copyable,
			ellipsis,
			emptyText,
			valueType,
			renderText,
			renderCopyableText,
			...rest
		} = col as ProColumnType<T>;

		const originalRender = (col as ColumnType<T>).render;

		// 确定有效的 render 函数
		let effectiveRender: ColumnType<T>["render"] | undefined;
		if (renderText) {
			effectiveRender = (value: unknown, record: T, index: number) =>
				renderText(value, record, index);
		} else if (valueType && !originalRender) {
			effectiveRender = (value: unknown) => renderByValueType(valueType, value);
		} else {
			effectiveRender = originalRender;
		}

		// 空值兜底：声明了 emptyText 的列，渲染结果为空时统一替换为占位内容
		// （放在 valueType / render 之后，避免各页为零值再手写一遍格式化逻辑）
		if (emptyText !== undefined) {
			const baseRender = effectiveRender;
			effectiveRender = (value: unknown, record: T, index: number) => {
				const content = baseRender
					? baseRender(value, record, index)
					: (value as React.ReactNode);
				return content === null || content === undefined || content === ""
					? emptyText
					: content;
			};
		}

		const hasCopyable = copyable === true;
		const hasCustomTooltipFlag = hasCustomTooltip(ellipsis);
		const hasSimpleEllipsis = typeof ellipsis === "boolean" && ellipsis;

		// 是否有任何一种自定义渲染需要 Tooltip 或 copyable 包装
		const needsTooltip = hasCustomTooltipFlag || hasSimpleEllipsis;
		const needsWrapping = hasCopyable || needsTooltip;

		// 不需要任何包装，直接返回
		if (!needsWrapping) {
			return {
				...rest,
				...(effectiveRender ? { render: effectiveRender } : {}),
				...(typeof ellipsis === "object" && ellipsis !== null
					? { ellipsis }
					: {}),
			} as ColumnType<T>;
		}

		// 需要包装：构建自定义 render
		// 传给 antd 的 ellipsis 使用 showTitle: false，避免 antd 自带的 Tooltip 与 ProTable 冲突
		const antdEllipsis: boolean | { showTitle?: boolean } | undefined =
			needsTooltip ? { showTitle: false } : undefined;

		return {
			...rest,
			...(antdEllipsis !== undefined ? { ellipsis: antdEllipsis } : {}),
			render: (value: unknown, record: T, index: number) => {
				const displayContent: React.ReactNode = effectiveRender
					? (effectiveRender(value, record, index) as React.ReactNode)
					: ((value as React.ReactNode) ?? null);

				if (displayContent === null || displayContent === undefined) {
					return null;
				}

				const rawValue =
					typeof value === "string" || typeof value === "number"
						? String(value)
						: "";

				const copyableValue = renderCopyableText
					? renderCopyableText(value, record, index)
					: rawValue;

				// 计算 Tooltip 标题
				let tooltipTitle: string | undefined;
				if (hasCustomTooltipFlag) {
					const customTitle = (ellipsis as { tooltip: TooltipProps }).tooltip
						.title;
					tooltipTitle =
						typeof customTitle === "string" ? customTitle : rawValue;
				} else if (hasSimpleEllipsis) {
					tooltipTitle =
						typeof displayContent === "string" ? displayContent : rawValue;
				}

				// 省略号 CSS（块级元素，占满单元格宽度）
				const ellipsisStyle: React.CSSProperties = {
					display: "block",
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
				};

				let child: React.ReactNode;

				if (hasCopyable && copyableValue) {
					child = (
						<span
							style={{
								display: "flex",
								alignItems: "center",
								gap: 4,
								width: "100%",
								overflow: "hidden",
							}}
						>
							<span
								style={{
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
									flex: "1 1 auto",
									minWidth: 0,
								}}
							>
								{displayContent}
							</span>
							<Button
								type="text"
								size="small"
								icon={<CopyOutlined />}
								style={{ flexShrink: 0 }}
								onClick={(e: React.MouseEvent<HTMLElement>) => {
									e.stopPropagation();
									void copyText(copyableValue);
								}}
							/>
						</span>
					);
				} else {
					child = <span style={ellipsisStyle}>{displayContent}</span>;
				}

				// Tooltip 包装（跳过空标题）
				if (needsTooltip && tooltipTitle) {
					const tooltipProps = hasCustomTooltipFlag
						? (ellipsis as { tooltip: TooltipProps }).tooltip
						: {};
					child = (
						<Tooltip {...tooltipProps} title={tooltipTitle}>
							{child}
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
 * - valueType 自动渲染（text / dateTime / dateTimeMinute）
 * - renderText 自定义文本渲染 + ellipsis Tooltip
 * - renderCopyableText 自定义复制文本 + 复制后提示
 * - ellipsis 统一 Tooltip 支持
 * - copyable 支持列值复制
 * - emptyText 为空值提供占位内容（可选）
 * - 表体高度缺省继承页面骨架注入的剩余空间（显式 scroll.y 优先）
 *
 * 调用方约定：`fixed` 列必须显式声明 `width`（无宽度会被挤压到剩余空间，
 * 宽度不足时内容溢出到相邻列），且 `scroll.x` 不小于各列宽度之和。
 */
export function ProTable<T>({
	bordered = true,
	columns,
	scroll,
	...restProps
}: ProTableProps<T>) {
	const processedColumns = useMemo(() => processColumns<T>(columns), [columns]);
	// 页面骨架（AdminListPage）测量出剩余高度后经 context 下发，表格无需逐页传 scroll.y
	const autoHeight = useTableHeight();
	const mergedScroll = useMemo(() => {
		const y = scroll?.y ?? autoHeight;
		if (y === undefined) return scroll;
		return { ...scroll, y };
	}, [scroll, autoHeight]);

	return (
		<Table<T>
			bordered={bordered}
			columns={processedColumns}
			scroll={mergedScroll}
			{...restProps}
		/>
	);
}
