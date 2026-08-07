/**
 * 事件分析页面：趋势图、事件分布、Top 页面
 */

import { Column, Line, Pie } from "@ant-design/charts";
import { ReloadOutlined } from "@ant-design/icons";
import { message } from "@fsdx/ui-spa/antd-static";
import { createFileRoute } from "@tanstack/react-router";
import {
	Button,
	Card,
	Col,
	DatePicker,
	Row,
	Select,
	Space,
	Spin,
	Statistic,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useRef, useState } from "react";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import type { TrackAnalyticsResult as AnalyticsResult } from "#/services/track/track.types";
import { getTrackAnalyticsSFn } from "./-mods/analytics.functions";

const { RangePicker } = DatePicker;

export const Route = createFileRoute("/admin/_admin/track/analytics")({
	component: EventAnalyticsPage,
});

function EventAnalyticsPage() {
	const today = dayjs();
	const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
		today.subtract(7, "day").startOf("day"),
		today.endOf("day"),
	]);
	const [granularity, setGranularity] = useState<"hour" | "day">("day");
	const [loading, setLoading] = useState(false);
	const [data, setData] = useState<AnalyticsResult | null>(null);

	const fetchAnalytics = async () => {
		setLoading(true);
		try {
			const result = await getTrackAnalyticsSFn({
				data: {
					startDate: dateRange[0].toISOString(),
					endDate: dateRange[1].toISOString(),
					granularity,
				},
			});
			setData(result);
		} catch (err) {
			message.error(err instanceof Error ? err.message : "加载分析数据失败");
		} finally {
			setLoading(false);
		}
	};

	// 页面挂载时自动查询
	const initialized = useRef(false);
	useEffect(() => {
		if (!initialized.current) {
			initialized.current = true;
			fetchAnalytics();
		}
	});

	const trendConfig = data?.timeSeries?.length
		? {
				data: data.timeSeries.map((d) => ({ date: d.date, value: d.count })),
				xField: "date",
				yField: "value",
				axis: {
					x: { labelAutoRotate: true },
				},
				height: 300,
				style: {
					lineWidth: 2,
				},
			}
		: null;

	const pieConfig = data?.eventDistribution?.length
		? {
				data: data.eventDistribution.map((d) => ({
					type: d.name,
					value: d.count,
				})),
				angleField: "value",
				colorField: "type",
				height: 300,
				label: {
					text: "type",
					style: { fontSize: 12 },
				},
				legend: {
					position: "bottom" as const,
				},
			}
		: null;

	const barConfig = data?.topPages?.length
		? {
				data: data.topPages.map((d) => ({ page: d.pageName, value: d.count })),
				xField: "page",
				yField: "value",
				height: 300,
				axis: {
					x: { labelAutoRotate: true, labelAutoHide: true },
				},
			}
		: null;

	return (
		<AdminPageContent
			title="事件分析"
			description="查看埋点事件趋势、分布和 Top 页面排行"
			extra={
				<Space>
					<Select
						value={granularity}
						onChange={(v: "hour" | "day") => setGranularity(v)}
						options={[
							{ label: "按小时", value: "hour" },
							{ label: "按天", value: "day" },
						]}
						style={{ width: 100 }}
					/>
					<RangePicker
						value={dateRange}
						onChange={(v: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) =>
							v && setDateRange(v as [dayjs.Dayjs, dayjs.Dayjs])
						}
					/>
					<Button
						type="primary"
						icon={<ReloadOutlined />}
						onClick={fetchAnalytics}
					>
						查询
					</Button>
				</Space>
			}
		>
			<Spin spinning={loading}>
				{data && (
					<>
						{/* 概览统计 */}
						<Row gutter={[16, 16]} className="mb-4">
							<Col xs={12} sm={6}>
								<Card size="small">
									<Statistic title="总事件数" value={data.totalEvents} />
								</Card>
							</Col>
							<Col xs={12} sm={6}>
								<Card size="small">
									<Statistic title="独立用户数" value={data.uniqueUsers} />
								</Card>
							</Col>
						</Row>

						{/* 事件趋势 */}
						<Card title="事件趋势" className="mb-4">
							{trendConfig ? (
								<Line {...trendConfig} />
							) : (
								<div className="flex items-center justify-center h-[300px] text-muted-foreground">
									暂无数据
								</div>
							)}
						</Card>

						{/* 事件分布 + Top 页面 */}
						<Row gutter={[16, 16]}>
							<Col xs={24} lg={12}>
								<Card title="事件分布">
									{pieConfig ? (
										<Pie {...pieConfig} />
									) : (
										<div className="flex items-center justify-center h-[300px] text-muted-foreground">
											暂无数据
										</div>
									)}
								</Card>
							</Col>
							<Col xs={24} lg={12}>
								<Card title="Top 页面 (PageView)">
									{barConfig ? (
										<Column {...barConfig} />
									) : (
										<div className="flex items-center justify-center h-[300px] text-muted-foreground">
											暂无数据
										</div>
									)}
								</Card>
							</Col>
						</Row>
					</>
				)}
				{!data && !loading && (
					<div className="flex items-center justify-center h-[400px] text-muted-foreground">
						请选择时间范围后点击查询
					</div>
				)}
			</Spin>
		</AdminPageContent>
	);
}
