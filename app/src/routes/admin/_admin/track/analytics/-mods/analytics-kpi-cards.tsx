/**
 * 事件分析概览 KPI 卡：总事件数 / 独立用户数 / 人均事件数 / 事件种类数，带周期对比涨跌
 */
import { Card, Col, Row, Statistic } from "antd";
import type { AnalyticsDelta } from "#/services/track/track.types";

interface AnalyticsKpiCardsProps {
	totalEvents: number;
	uniqueUsers: number;
	eventKinds: number;
	deltas?: { totalEvents: AnalyticsDelta; uniqueUsers: AnalyticsDelta };
}

/** 周期对比涨跌徽标：正增长 success 色、负增长 danger 色、持平弱化 */
function DeltaBadge({ delta }: { delta: AnalyticsDelta | undefined }) {
	if (!delta || delta.value === null) {
		return <span className="text-xs text-foreground-tertiary">— 无对比</span>;
	}
	const v = delta.value;
	const percent = `${(Math.abs(v) * 100).toFixed(1)}%`;
	if (v === 0) {
		return (
			<span className="text-xs font-medium text-foreground-tertiary">
				持平（{percent}）
			</span>
		);
	}
	const up = v > 0;
	return (
		<span
			className={`text-xs font-medium ${up ? "text-success" : "text-danger"}`}
		>
			{up ? "↑" : "↓"} {percent}
		</span>
	);
}

export function AnalyticsKpiCards({
	totalEvents,
	uniqueUsers,
	eventKinds,
	deltas,
}: AnalyticsKpiCardsProps) {
	// 人均事件数：无独立用户时显示 0
	const avgEvents = uniqueUsers > 0 ? totalEvents / uniqueUsers : 0;

	return (
		<Row gutter={[16, 16]}>
			<Col xs={24} sm={12} lg={6}>
				<Card size="small">
					<Statistic title="总事件数" value={totalEvents} />
					<div className="mt-2">
						<DeltaBadge delta={deltas?.totalEvents} />
					</div>
				</Card>
			</Col>
			<Col xs={24} sm={12} lg={6}>
				<Card size="small">
					<Statistic title="独立用户数" value={uniqueUsers} />
					<div className="mt-2">
						<DeltaBadge delta={deltas?.uniqueUsers} />
					</div>
				</Card>
			</Col>
			<Col xs={24} sm={12} lg={6}>
				<Card size="small">
					<Statistic title="人均事件数" value={avgEvents} precision={2} />
				</Card>
			</Col>
			<Col xs={24} sm={12} lg={6}>
				<Card size="small">
					<Statistic title="事件种类数" value={eventKinds} />
				</Card>
			</Col>
		</Row>
	);
}
