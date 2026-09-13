/**
 * 分析概览 KPI 卡：统一网格布局与周期对比涨跌展示，供各分析页复用
 */

import { Card, Col, Row, Statistic } from "antd";

/** 单个 KPI 项：delta 为变化率（0.1 = 上涨 10%），null 表示无对比，undefined 表示不展示涨跌 */
export interface AnalyticsKpiItem {
	title: string;
	value: number;
	precision?: number;
	suffix?: string;
	delta?: number | null;
}

interface AnalyticsKpiCardsProps {
	items: AnalyticsKpiItem[];
	/** 大屏每行列数，默认 4 */
	columns?: 3 | 4 | 6;
}

/** 涨跌徽标：涨 success、跌 danger、持平弱化、无对比显示占位 */
function DeltaBadge({ delta }: { delta: number | null }) {
	if (delta === null) {
		return <span className="text-xs text-foreground-tertiary">— 无对比</span>;
	}
	const percent = `${(Math.abs(delta) * 100).toFixed(1)}%`;
	if (delta === 0) {
		return (
			<span className="text-xs font-medium text-foreground-tertiary">
				持平（{percent}）
			</span>
		);
	}
	const up = delta > 0;
	return (
		<span
			className={`text-xs font-medium ${up ? "text-success" : "text-danger"}`}
		>
			{up ? "↑" : "↓"} {percent}
		</span>
	);
}

/** 分析概览 KPI 卡网格 */
export function AnalyticsKpiCards({
	items,
	columns = 4,
}: AnalyticsKpiCardsProps) {
	const span = columns === 6 ? 4 : columns === 3 ? 8 : 6;

	return (
		<Row gutter={[16, 16]}>
			{items.map((item) => (
				<Col key={item.title} xs={24} sm={12} lg={span}>
					<Card size="small">
						<Statistic
							title={item.title}
							value={item.value}
							precision={item.precision}
							suffix={item.suffix}
						/>
						{item.delta !== undefined && (
							<div className="mt-2">
								<DeltaBadge delta={item.delta} />
							</div>
						)}
					</Card>
				</Col>
			))}
		</Row>
	);
}
