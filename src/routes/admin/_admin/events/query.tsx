/**
 * 埋点事件查询页面：按条件筛选、分页查看触发事件
 */
import {
	DownloadOutlined,
	ReloadOutlined,
	SearchOutlined,
} from "@ant-design/icons";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
	Button,
	DatePicker,
	Input,
	message,
	Select,
	Space,
	Table,
	Tag,
	Tooltip,
} from "antd";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { z } from "zod";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import type { SortOrder } from "#/lib/query/query-utils";
import { adminPermGuard } from "#/middleware/admin-auth";
import { getEventNames, searchEvents } from "#/server/event/event.server";
import type {
	EventQueryResult,
	EventRecord,
	PresetPropertyRecord,
} from "#/server/event/event.types";
import { getPresetEventsSFn } from "./preset-events/-mods/preset-events.functions";
import { getPresetPropertiesSFn } from "./preset-properties/-mods/preset-properties.functions";

const { RangePicker } = DatePicker;

const eventQuerySchema = z.object({
	event: z.string().optional(),
	userId: z.string().optional(),
	sessionId: z.string().optional(),
	keyword: z.string().optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	page: z.number().int().min(1).optional(),
	pageSize: z.number().int().min(1).max(100).optional(),
	sortField: z.string().optional(),
	sortOrder: z.enum(["ascend", "descend"]).optional(),
});

/** 分页查询埋点事件 */
const searchEventsSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.EVENT_QUERY)])
	.inputValidator(eventQuerySchema)
	.handler(async ({ data }) => searchEvents(data));

/** 获取已有的事件名称列表 */
const getEventNamesSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.EVENT_QUERY)])
	.handler(async () => getEventNames());

export const Route = createFileRoute("/admin/_admin/events/query")({
	component: EventListPage,
	loader: async () => {
		const [eventNames, presetEvents, presetProperties, result] =
			await Promise.all([
				getEventNamesSFn(),
				getPresetEventsSFn().catch(() => []),
				getPresetPropertiesSFn().catch(() => []),
				searchEventsSFn({ data: {} }),
			]);
		return { eventNames, presetEvents, presetProperties, result };
	},
});

function EventListPage() {
	const {
		eventNames: initialEventNames,
		presetEvents,
		presetProperties,
		result: initialResult,
	} = Route.useLoaderData();

	const [data, setData] = useState<EventQueryResult>(initialResult);
	const [eventNames] = useState<string[]>(initialEventNames);
	const [loading, setLoading] = useState(false);

	/** 事件名 → 显示名称映射 */
	const eventLabelMap = useMemo(() => {
		const map: Record<string, string> = {};
		for (const e of presetEvents) {
			map[e.name] = e.label;
		}
		return map;
	}, [presetEvents]);

	/** 属性键 → 显示名称映射 */
	const propertyLabelMap = useMemo(() => {
		const map: Record<
			string,
			Pick<PresetPropertyRecord, "label" | "dataType">
		> = {};
		for (const p of presetProperties) {
			map[p.key] = { label: p.label, dataType: p.dataType };
		}
		return map;
	}, [presetProperties]);

	// 筛选条件
	const [filterEvent, setFilterEvent] = useState<string | undefined>();
	const [filterKeyword, setFilterKeyword] = useState("");
	const [filterDateRange, setFilterDateRange] = useState<
		[dayjs.Dayjs, dayjs.Dayjs] | null
	>(null);
	const pageSize = 20;
	const [sortField, setSortField] = useState<string | undefined>();
	const [sortOrder, setSortOrder] = useState<SortOrder | undefined>();

	/** 核心查询方法：接受明确的 page/pageSize，消除闭包过期问题 */
	const searchWith = async (
		p: number,
		ps: number,
		sf?: string,
		so?: SortOrder,
	) => {
		setLoading(true);
		try {
			const field = sf !== undefined ? sf : sortField;
			const order = so !== undefined ? so : sortOrder;
			const result = await searchEventsSFn({
				data: {
					event: filterEvent,
					keyword: filterKeyword || undefined,
					startDate: filterDateRange?.[0]?.startOf("day").toISOString(),
					endDate: filterDateRange?.[1]?.endOf("day").toISOString(),
					page: p,
					pageSize: ps,
					sortField: field,
					sortOrder: order,
				},
			});
			setData(result);
		} catch (err) {
			message.error(err instanceof Error ? err.message : "查询失败");
		} finally {
			setLoading(false);
		}
	};

	/** 表格排序变更 */
	const handleTableChange = (
		_pagination: unknown,
		_filters: unknown,
		sorter: unknown,
	) => {
		const s = sorter as { field?: string; order?: string };
		setSortField(s.field);
		setSortOrder(s.order as SortOrder | undefined);
		searchWith(data.page, pageSize, s.field, s.order as SortOrder | undefined);
	};

	/** 搜索按钮：重置到第 1 页 */
	const handleSearch = () => {
		searchWith(1, pageSize);
	};

	/** 分页切换 */
	const handlePageChange = async (p: number, ps: number) => {
		await searchWith(p, ps);
	};

	const handleExport = () => {
		const headers = [
			"事件名称",
			"用户ID",
			"会话ID",
			"属性",
			"触发时间",
			"接收时间",
		];
		const rows = data.records.map((e: EventRecord) => [
			e.event,
			e.userId ?? "-",
			e.sessionId,
			JSON.stringify(e.properties),
			e.time ? new Date(e.time).toISOString() : "-",
			e.createdAt ? new Date(e.createdAt).toISOString() : "-",
		]);
		const csv = [
			headers.join(","),
			...rows.map((r) =>
				r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
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

	const formatValue = (value: unknown): string => {
		if (value === null || value === undefined) return "-";
		if (typeof value === "object") return JSON.stringify(value, null, 2);
		return String(value);
	};

	const columns = [
		{
			title: "事件名称",
			dataIndex: "event",
			key: "event",
			width: 140,
			render: (v: string) => {
				const label = eventLabelMap[v];
				return (
					<span className="flex items-center gap-1.5">
						<span className="text-sm font-medium">{label ?? v}</span>
						{label && (
							<Tag className="m-0 text-xs leading-none" color="blue">
								{v}
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
			render: (v: string | null) =>
				v || <span className="text-gray-400">匿名</span>,
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
			render: (v: Record<string, unknown>) => JSON.stringify(v),
		},
		{
			title: "触发时间",
			dataIndex: "time",
			key: "time",
			width: 180,
			sorter: true,
			sortOrder: sortField === "time" ? sortOrder : undefined,
			render: (v: string) => (v ? dayjs(v).format("YYYY-MM-DD HH:mm:ss") : "-"),
		},
		{
			title: "接收时间",
			dataIndex: "createdAt",
			key: "createdAt",
			width: 180,
			render: (v: string) => (v ? dayjs(v).format("YYYY-MM-DD HH:mm:ss") : "-"),
		},
	];

	return (
		<AdminPageContent
			title="埋点事件查询"
			description="查询和分析客户端上报的埋点事件数据"
			extra={
				<Space>
					<Button
						icon={<DownloadOutlined />}
						onClick={handleExport}
						disabled={data.records.length === 0}
					>
						导出 CSV
					</Button>
					<Button icon={<ReloadOutlined />} onClick={handleSearch}>
						刷新
					</Button>
				</Space>
			}
		>
			{/* 筛选栏 */}
			<div className="mb-4 flex flex-wrap items-center gap-3">
				<Select
					placeholder="事件名称"
					value={filterEvent}
					onChange={(v) => {
						setFilterEvent(v);
					}}
					allowClear
					style={{ width: 160 }}
					options={eventNames.map((n) => ({
						label: eventLabelMap[n] ?? n,
						value: n,
					}))}
				/>
				<Input
					placeholder="关键词搜索（事件/属性）"
					value={filterKeyword}
					onChange={(e) => setFilterKeyword(e.target.value)}
					onPressEnter={handleSearch}
					allowClear
					style={{ width: 240 }}
					prefix={<SearchOutlined />}
				/>
				<RangePicker
					value={filterDateRange}
					onChange={(v) => {
						setFilterDateRange(v as [dayjs.Dayjs, dayjs.Dayjs] | null);
					}}
					showTime={false}
					placeholder={["开始日期", "结束日期"]}
				/>
				<Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
					查询
				</Button>
			</div>

			<Table
				columns={columns}
				dataSource={data.records}
				rowKey="id"
				loading={loading}
				scroll={{ x: 1100 }}
				onChange={handleTableChange}
				locale={{ emptyText: "暂无事件数据" }}
				expandable={{
					rowExpandable: (record) => Object.keys(record.properties).length > 0,
					expandedRowRender: (record) => {
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
											className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2"
										>
											<div className="mb-1 flex items-center gap-1.5">
												<span className="text-sm font-medium text-gray-800">
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
												<div className="max-h-16 overflow-hidden text-xs text-gray-600 break-all font-mono">
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
				pagination={{
					current: data.page,
					pageSize: data.pageSize,
					total: data.total,
					onChange: handlePageChange,
					showSizeChanger: false,
					showTotal: (total) => `共 ${total} 条`,
				}}
			/>
		</AdminPageContent>
	);
}
