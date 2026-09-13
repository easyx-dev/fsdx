/**
 * 操作日志分析筛选区：时间范围（含快捷项）/ 模块 / 动作 / 操作人 / 分组维度 / 粒度 / 周期对比
 */

import { RedoOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, DatePicker, Input, Segmented, Select, Space } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { ACTION_LABELS, MODULE_LABELS } from "#/constants/operation-log-meta";

/** 未提交的筛选状态 */
export interface OperationLogAnalyticsFilterState {
	dateRange: [Dayjs, Dayjs];
	granularity: "hour" | "day" | "week";
	breakdown: "action" | "module";
	module: string;
	action: string;
	operatorName?: string;
	compare: "none" | "previous";
}

interface OperationLogAnalyticsFilterProps {
	filter: OperationLogAnalyticsFilterState;
	onChange: (patch: Partial<OperationLogAnalyticsFilterState>) => void;
	onQuery: () => void;
	onReset: () => void;
	modules: string[];
}

export function OperationLogAnalyticsFilter({
	filter,
	onChange,
	onQuery,
	onReset,
	modules,
}: OperationLogAnalyticsFilterProps) {
	const moduleOptions = [
		{ label: "全部模块", value: "" },
		...modules.map((m) => ({ label: MODULE_LABELS[m] ?? m, value: m })),
	];
	const actionOptions = [
		{ label: "全部动作", value: "" },
		...Object.entries(ACTION_LABELS).map(([value, label]) => ({
			label,
			value,
		})),
	];

	return (
		<Space wrap size={[12, 12]} className="w-full">
			<DatePicker.RangePicker
				value={filter.dateRange}
				onChange={(v) => v && onChange({ dateRange: v as [Dayjs, Dayjs] })}
				presets={[
					{
						label: "今天",
						value: [dayjs().startOf("day"), dayjs().endOf("day")],
					},
					{
						label: "近 7 天",
						value: [
							dayjs().subtract(6, "day").startOf("day"),
							dayjs().endOf("day"),
						],
					},
					{
						label: "近 30 天",
						value: [
							dayjs().subtract(29, "day").startOf("day"),
							dayjs().endOf("day"),
						],
					},
				]}
			/>
			<Select
				value={filter.module}
				onChange={(v: string) => onChange({ module: v })}
				options={moduleOptions}
				style={{ minWidth: 130 }}
			/>
			<Select
				value={filter.action}
				onChange={(v: string) => onChange({ action: v })}
				options={actionOptions}
				style={{ minWidth: 130 }}
			/>
			<Input
				value={filter.operatorName}
				onChange={(e) => onChange({ operatorName: e.target.value })}
				placeholder="操作人"
				allowClear
				style={{ width: 140 }}
			/>
			<Segmented
				value={filter.breakdown}
				onChange={(v) => onChange({ breakdown: v as "action" | "module" })}
				options={[
					{ label: "按动作", value: "action" },
					{ label: "按模块", value: "module" },
				]}
			/>
			<Segmented
				value={filter.granularity}
				onChange={(v) =>
					onChange({
						granularity: v as OperationLogAnalyticsFilterState["granularity"],
					})
				}
				options={[
					{ label: "按小时", value: "hour" },
					{ label: "按天", value: "day" },
					{ label: "按周", value: "week" },
				]}
			/>
			<Segmented
				value={filter.compare}
				onChange={(v) => onChange({ compare: v as "none" | "previous" })}
				options={[
					{ label: "不对比", value: "none" },
					{ label: "环比", value: "previous" },
				]}
			/>
			<Space>
				<Button type="primary" icon={<ReloadOutlined />} onClick={onQuery}>
					查询
				</Button>
				<Button icon={<RedoOutlined />} onClick={onReset}>
					重置
				</Button>
			</Space>
		</Space>
	);
}
