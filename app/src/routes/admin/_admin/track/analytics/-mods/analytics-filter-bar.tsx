/**
 * 事件分析筛选区：时间范围（含快捷项）/ 事件多选 / 指标 / 维度拆解 / 周期对比 / 粒度
 */

import { RedoOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, DatePicker, Segmented, Select, Space } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import type {
	TrackEventMetaRecord,
	TrackPropertyMetaRecord,
} from "#/services/track/track.types";

const { RangePicker } = DatePicker;

/** 未提交的筛选状态（点查询后进入查询参数） */
export interface AnalyticsFilterState {
	dateRange: [Dayjs, Dayjs];
	granularity: "hour" | "day" | "week";
	eventNames: string[];
	metric: "count" | "users";
	breakdown: string | undefined;
	compare: "none" | "previous" | "year";
}

interface AnalyticsFilterBarProps {
	filter: AnalyticsFilterState;
	onChange: (patch: Partial<AnalyticsFilterState>) => void;
	onQuery: () => void;
	onReset: () => void;
	eventMetas: TrackEventMetaRecord[];
	propertyMetas: TrackPropertyMetaRecord[];
}

/** 不适合作为拆解维度的系统属性 */
const DISMISS_KEYS = new Set(["$ip", "$user_agent", "$screen_size", "url"]);

export function AnalyticsFilterBar({
	filter,
	onChange,
	onQuery,
	onReset,
	eventMetas,
	propertyMetas,
}: AnalyticsFilterBarProps) {
	// 事件选项用元事件 label，缺省回退原事件名
	const eventOptions = eventMetas.map((m) => ({
		label: m.label ?? m.name,
		value: m.name,
	}));

	// 维度选项：string 型元属性，排除不适合拆分的系统属性
	const breakdownOptions = propertyMetas
		.filter((p) => p.dataType === "string" && !DISMISS_KEYS.has(p.key))
		.map((p) => ({ label: p.label ?? p.key, value: p.key }));

	const presets = [
		{
			label: "今天",
			value: [dayjs().startOf("day"), dayjs().endOf("day")] as [Dayjs, Dayjs],
		},
		{
			label: "近 7 天",
			value: [
				dayjs().subtract(6, "day").startOf("day"),
				dayjs().endOf("day"),
			] as [Dayjs, Dayjs],
		},
		{
			label: "近 30 天",
			value: [
				dayjs().subtract(29, "day").startOf("day"),
				dayjs().endOf("day"),
			] as [Dayjs, Dayjs],
		},
		{
			label: "本月",
			value: [dayjs().startOf("month"), dayjs().endOf("day")] as [Dayjs, Dayjs],
		},
	];

	return (
		<Space wrap size={[12, 12]} className="w-full">
			<RangePicker
				value={filter.dateRange}
				onChange={(v) => v && onChange({ dateRange: v as [Dayjs, Dayjs] })}
				presets={presets}
			/>
			<Select
				mode="multiple"
				placeholder="全部事件"
				value={filter.eventNames.length ? filter.eventNames : undefined}
				onChange={(v: string[]) => onChange({ eventNames: v })}
				options={eventOptions}
				allowClear
				style={{ minWidth: 180 }}
				maxTagCount="responsive"
			/>
			<Segmented
				value={filter.metric}
				onChange={(v) => onChange({ metric: v as "count" | "users" })}
				options={[
					{ label: "次数", value: "count" },
					{ label: "用户数", value: "users" },
				]}
			/>
			<Select
				placeholder="维度拆解"
				value={filter.breakdown}
				onChange={(v?: string) => onChange({ breakdown: v })}
				options={[{ label: "不拆解", value: "" }, ...breakdownOptions]}
				allowClear
				style={{ minWidth: 140 }}
			/>
			<Select
				value={filter.compare}
				onChange={(v) => onChange({ compare: v as typeof filter.compare })}
				options={[
					{ label: "不对比", value: "none" },
					{ label: "环比", value: "previous" },
					{ label: "同比", value: "year" },
				]}
				style={{ width: 110 }}
			/>
			<Segmented
				value={filter.granularity}
				onChange={(v) =>
					onChange({ granularity: v as "hour" | "day" | "week" })
				}
				options={[
					{ label: "按小时", value: "hour" },
					{ label: "按天", value: "day" },
					{ label: "按周", value: "week" },
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
