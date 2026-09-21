/**
 * 埋点事件查询页面：按事件、关键词与日期范围检索客户端上报的埋点事件
 * 筛选为「点查询才请求」模式，事件/关键词/日期仅维护草稿条件
 */
import {
	DownloadOutlined,
	ReloadOutlined,
	SearchOutlined,
} from "@ant-design/icons";
import { message } from "@fsdx/ui-spa/antd-static";
import { ProTable } from "@fsdx/ui-spa/table";
import { createFileRoute } from "@tanstack/react-router";
import { Button, DatePicker, Input, Select, Tag, Tooltip } from "antd";
import dayjs from "dayjs";
import type { ChangeEvent } from "react";
import { useCallback, useMemo, useState } from "react";
import { AdminListPage, AdminTableToolbar } from "#/components/admin";
import {
	getTrackEventMetaSFn,
	getTrackPropertyMetaSFn,
} from "#/services/track/track.functions";
import type {
	TrackEventRecord,
	TrackPropertyMetaRecord,
} from "#/services/track/track.types";
import { useListQuery } from "#/utils/use-list-query";
import {
	getTrackEventNamesSFn,
	searchTrackEventsSFn,
} from "./-mods/query.functions";

const { RangePicker } = DatePicker;

/** 埋点事件列表筛选条件 */
interface TrackEventFilters {
	name: string;
	keyword: string;
	startDate?: string;
	endDate?: string;
}

export const Route = createFileRoute("/admin/_admin/track/query")({
	component: EventListPage,
	loader: async () => {
		const [eventNames, presetEvents, presetProperties, result] =
			await Promise.all([
				getTrackEventNamesSFn(),
				getTrackEventMetaSFn().catch(() => []),
				getTrackPropertyMetaSFn().catch(() => []),
				searchTrackEventsSFn({ data: {} }),
			]);
		return { eventNames, presetEvents, presetProperties, result };
	},
});

function EventListPage() {
	const {
		eventNames,
		presetEvents,
		presetProperties,
		result: initialResult,
	} = Route.useLoaderData();

	// 草稿条件：仅在点击「查询」时提交
	const [eventName, setEventName] = useState<string>();
	const [keyword, setKeyword] = useState("");
	const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(
		null,
	);

	const list = useListQuery<TrackEventRecord, TrackEventFilters>({
		initial: {
			records: initialResult.records,
			total: initialResult.total,
			page: initialResult.page,
			pageSize: initialResult.pageSize,
		},
		initialFilters: { name: "", keyword: "" },
		errorMessage: "埋点事件查询失败",
		fetcher: useCallback(
			async ({ page, pageSize, sortField, sortOrder, filters }) =>
				searchTrackEventsSFn({
					data: {
						name: filters.name || undefined,
						keyword: filters.keyword || undefined,
						startDate: filters.startDate,
						endDate: filters.endDate,
						page,
						pageSize,
						sortField,
						sortOrder,
					},
				}),
			[],
		),
	});

	/** 事件名 → 显示名称映射 */
	const eventLabelMap = useMemo(() => {
		const map: Record<string, string> = {};
		for (const event of presetEvents) {
			map[event.name] = event.label;
		}
		return map;
	}, [presetEvents]);

	/** 属性键 → 显示名称映射 */
	const propertyLabelMap = useMemo(() => {
		const map: Record<
			string,
			Pick<TrackPropertyMetaRecord, "label" | "dataType">
		> = {};
		for (const property of presetProperties) {
			map[property.key] = {
				label: property.label,
				dataType: property.dataType,
			};
		}
		return map;
	}, [presetProperties]);

	/** 提交草稿条件查询（applyFilters 自动回到第 1 页） */
	const handleSearch = () => {
		list.applyFilters({
			name: eventName ?? "",
			keyword,
			startDate: dateRange?.[0]?.format("YYYY-MM-DD"),
			endDate: dateRange?.[1]?.format("YYYY-MM-DD"),
		});
	};

	/** 重置筛选条件并重新查询 */
	const handleReset = () => {
		setEventName(undefined);
		setKeyword("");
		setDateRange(null);
		list.applyFilters({
			name: "",
			keyword: "",
			startDate: undefined,
			endDate: undefined,
		});
	};

	/** 导出当前页事件为 CSV */
	const handleExport = () => {
		const headers = [
			"事件名称",
			"用户ID",
			"会话ID",
			"属性",
			"触发时间",
			"接收时间",
		];
		const rows = list.data.records.map((event) => [
			event.name,
			event.userId ?? "-",
			event.sessionId,
			JSON.stringify(event.properties),
			event.time ? new Date(event.time).toISOString() : "-",
			event.createdAt ? new Date(event.createdAt).toISOString() : "-",
		]);
		const csv = [
			headers.join(","),
			...rows.map((row) =>
				row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
			),
		].join("\n");
		const blob = new Blob([`\uFEFF${csv}`], {
			type: "text/csv;charset=utf-8;",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `埋点事件_${dayjs().format("YYYYMMDD_HHmmss")}.csv`;
		a.click();
		URL.revokeObjectURL(url);
		message.success("导出成功");
	};

	/** 属性值的展示文本：对象转 JSON，空值显示占位符 */
	const formatValue = (value: unknown): string => {
		if (value === null || value === undefined) return "-";
		if (typeof value === "object") return JSON.stringify(value, null, 2);
		return String(value);
	};

	const columns = [
		{
			title: "事件名称",
			dataIndex: "name",
			key: "name",
			width: 140,
			render: (value: string) => {
				const label = eventLabelMap[value];
				return (
					<span className="flex items-center gap-1.5">
						<span className="text-sm font-medium">{label ?? value}</span>
						{label && (
							<Tag className="m-0 text-xs leading-none" color="blue">
								{value}
							</Tag>
						)}
					</span>
				);
			},
		},
		{
			title: "用户 ID",
			dataIndex: "userId",
			key: "userId",
			width: 200,
			ellipsis: true,
			render: (value: string | null) =>
				value || <span className="text-muted-foreground">匿名</span>,
		},
		{
			title: "会话 ID",
			dataIndex: "sessionId",
			key: "sessionId",
			width: 120,
			ellipsis: true,
		},
		{
			title: "属性",
			dataIndex: "properties",
			key: "properties",
			width: 200,
			ellipsis: true,
			render: (value: Record<string, unknown>) => JSON.stringify(value),
		},
		{
			title: "触发时间",
			dataIndex: "time",
			key: "time",
			width: 180,
			valueType: "dateTimeMinute" as const,
			// 服务层排序白名单仅支持 time
			...list.sortProps("time"),
		},
		{
			title: "接收时间",
			dataIndex: "createdAt",
			key: "createdAt",
			width: 180,
			valueType: "dateTimeMinute" as const,
		},
	];

	return (
		<AdminListPage
			title="埋点事件查询"
			description="查询和分析客户端上报的埋点事件数据"
			toolbar={
				<AdminTableToolbar
					onReset={handleReset}
					extra={
						<>
							<Button
								type="primary"
								icon={<SearchOutlined />}
								onClick={handleSearch}
							>
								查询
							</Button>
							<Button
								icon={<DownloadOutlined />}
								onClick={handleExport}
								disabled={list.data.records.length === 0}
							>
								导出 CSV
							</Button>
							<Button
								icon={<ReloadOutlined />}
								onClick={() => void list.reload()}
							>
								刷新
							</Button>
						</>
					}
				>
					<Select
						placeholder="事件名称"
						value={eventName}
						onChange={setEventName}
						allowClear
						style={{ width: 160 }}
						options={eventNames.map((name) => ({
							label: eventLabelMap[name] ?? name,
							value: name,
						}))}
					/>
					<Input
						placeholder="关键词搜索（事件/属性）"
						value={keyword}
						onChange={(e: ChangeEvent<HTMLInputElement>) =>
							setKeyword(e.target.value)
						}
						onPressEnter={handleSearch}
						allowClear
						style={{ width: 240 }}
						prefix={<SearchOutlined />}
					/>
					<RangePicker
						value={dateRange}
						onChange={(value) =>
							setDateRange(value as [dayjs.Dayjs, dayjs.Dayjs] | null)
						}
						showTime={false}
						placeholder={["开始日期", "结束日期"]}
					/>
				</AdminTableToolbar>
			}
		>
			<ProTable
				columns={columns}
				dataSource={list.data.records}
				rowKey="id"
				loading={list.loading}
				scroll={{ x: 1100 }}
				onChange={list.onTableChange}
				pagination={list.pagination}
				locale={{ emptyText: "暂无事件数据" }}
				expandable={{
					rowExpandable: (record: TrackEventRecord) =>
						Object.keys(record.properties).length > 0,
					expandedRowRender: (record: TrackEventRecord) => {
						const entries = Object.entries(record.properties);
						return (
							<div className="grid grid-cols-1 gap-2 py-2 pl-12 pr-4 sm:grid-cols-2 xl:grid-cols-3">
								{entries.map(([key, value]) => {
									const meta = propertyLabelMap[key];
									const displayLabel = meta?.label ?? key;
									const valueStr = formatValue(value);
									return (
										<div
											key={key}
											className="rounded-lg border border-border bg-background-secondary px-3 py-2"
										>
											<div className="mb-1 flex items-center gap-1.5">
												<span className="text-sm font-medium text-foreground">
													{displayLabel}
												</span>
												{meta && (
													<Tag
														className="m-0 text-xs leading-none"
														color="default"
													>
														{key}
													</Tag>
												)}
											</div>
											<Tooltip title={valueStr} mouseEnterDelay={0.5}>
												<div className="max-h-16 overflow-hidden text-xs text-muted-foreground break-all font-mono">
													{valueStr}
												</div>
											</Tooltip>
										</div>
									);
								})}
							</div>
						);
					},
				}}
			/>
		</AdminListPage>
	);
}
