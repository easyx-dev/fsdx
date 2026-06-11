/**
 * 埋点事件查询页面：按条件筛选、分页查看触发事件
 */
import {
	DownloadOutlined,
	ReloadOutlined,
	SearchOutlined,
} from "@ant-design/icons";
import { createFileRoute } from "@tanstack/react-router";
import {
	Button,
	DatePicker,
	Input,
	message,
	Select,
	Space,
	Table,
	Tag,
} from "antd";
import dayjs from "dayjs";
import { useState } from "react";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import type { SortOrder } from "#/lib/query/query-utils";
import {
	getEventNamesFn,
	searchEventsFn,
} from "#/server/event/event.functions";
import type { EventQueryResult, EventRecord } from "#/server/event/event.types";

const { RangePicker } = DatePicker;

export const Route = createFileRoute("/admin/_admin/events/query")({
	component: EventListPage,
	loader: async () => {
		const [eventNames, result] = await Promise.all([
			getEventNamesFn(),
			searchEventsFn({ data: {} }),
		]);
		return { eventNames, result };
	},
});

function EventListPage() {
	const { eventNames: initialEventNames, result: initialResult } =
		Route.useLoaderData();

	const [data, setData] = useState<EventQueryResult>(initialResult);
	const [eventNames] = useState<string[]>(initialEventNames);
	const [loading, setLoading] = useState(false);

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
			const result = await searchEventsFn({
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

	const columns = [
		{
			title: "事件名称",
			dataIndex: "event",
			key: "event",
			width: 120,
			render: (v: string) => <Tag color="blue">{v}</Tag>,
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
					options={eventNames.map((n) => ({ label: n, value: n }))}
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
