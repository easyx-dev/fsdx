/**
 * 系统监控图表配置与格式化：纯函数（可单测）
 * 负责历史趋势折线组装与字节 / 时长可读化
 */
import type { LineConfig } from "@ant-design/charts";
import type {
	SystemMetricHistoryMetric,
	SystemMetricHistoryPoint,
} from "#/services/system-metric/system-metric.types";

/** 历史指标展示元数据：中文名、原始值 → 展示值换算系数、折线颜色 */
export const HISTORY_METRIC_META: Record<
	SystemMetricHistoryMetric,
	{ label: string; scale: number; color: string }
> = {
	rss: {
		label: "常驻内存",
		scale: 1 / 1024 / 1024,
		color: "#4d9fff",
	},
	heapUsed: {
		label: "已用堆内存",
		scale: 1 / 1024 / 1024,
		color: "#00b96b",
	},
	cpuPercent: { label: "CPU 使用率", scale: 1, color: "#f5a623" },
	eventLoopLag: {
		label: "事件循环延迟",
		scale: 1,
		color: "#8b6cf0",
	},
	dbTotalBytes: {
		label: "数据库大小",
		scale: 1 / 1024 / 1024,
		color: "#ef5aa8",
	},
	httpRequests: {
		label: "每分钟请求数",
		scale: 1,
		color: "#2ec4b6",
	},
};

/** 历史指标下拉选项 */
export const HISTORY_METRIC_OPTIONS = (
	Object.keys(HISTORY_METRIC_META) as SystemMetricHistoryMetric[]
).map((key) => ({ label: HISTORY_METRIC_META[key].label, value: key }));

/** 字节可读化（B / KB / MB / GB / TB） */
export function formatBytes(bytes: number, precision = 1): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
	const units = ["B", "KB", "MB", "GB", "TB"];
	const index = Math.min(
		Math.floor(Math.log(bytes) / Math.log(1024)),
		units.length - 1,
	);
	const value = bytes / 1024 ** index;
	return `${value.toFixed(index === 0 ? 0 : precision)} ${units[index]}`;
}

/** 组装单指标历史折线配置：无数据返回 null */
export function buildHistoryConfig(
	points: SystemMetricHistoryPoint[],
	metric: SystemMetricHistoryMetric,
): LineConfig | null {
	const meta = HISTORY_METRIC_META[metric];
	const data = points
		.filter((point) => point.metric === metric)
		.map((point) => ({ date: point.date, value: point.value * meta.scale }));
	if (!data.length) return null;

	return {
		data,
		xField: "date",
		yField: "value",
		height: 320,
		autoFit: true,
		color: meta.color,
		axis: {
			x: { title: false, labelAutoRotate: true },
			y: { title: false },
		},
		point: { size: 3 },
		lineStyle: { lineWidth: 2 },
	};
}
