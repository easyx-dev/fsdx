/**
 * 日志查询页面：antd Form + Table 实现日志搜索、筛选与分页
 */

import {
	FileTextOutlined,
	ReloadOutlined,
	SearchOutlined,
} from "@ant-design/icons";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
	Button,
	DatePicker,
	Form,
	Input,
	message,
	Select,
	Table,
	Tag,
} from "antd";
import { useState } from "react";
import { z } from "zod";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { permGuard } from "#/middleware/server-fn-auth";
import {
	getLogDates as getLogDatesService,
	type LogEntry,
	type LogQueryResult,
	searchLogs as searchLogsService,
} from "#/server/logs";

const searchLogsSchema = z.object({
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	keyword: z.string().optional(),
	level: z.string().optional(),
	page: z.number().optional(),
	pageSize: z.number().optional(),
});

const searchLogsFn = createServerFn({ method: "GET" })
	.middleware([permGuard(PERMISSIONS.LOG_VIEW)])
	.inputValidator(searchLogsSchema)
	.handler(async ({ data }) => {
		return searchLogsService(data);
	});

const getDatesFn = createServerFn({ method: "GET" })
	.middleware([permGuard(PERMISSIONS.LOG_VIEW)])
	.handler(async () => {
		return getLogDatesService();
	});

/** 日志级别对应 Tag 颜色 */
const LEVEL_COLORS: Record<string, string> = {
	info: "blue",
	warn: "gold",
	error: "red",
	debug: "default",
	fatal: "red",
};

/** 日志级别选项 */
const LEVEL_OPTIONS = [
	{ label: "全部", value: "" },
	{ label: "INFO", value: "info" },
	{ label: "WARN", value: "warn" },
	{ label: "ERROR", value: "error" },
	{ label: "DEBUG", value: "debug" },
	{ label: "FATAL", value: "fatal" },
];

/** 将日志时间戳转为本地化时间字符串 */
function formatTime(entry: LogEntry): string {
	const t =
		typeof entry.time === "number"
			? new Date(entry.time)
			: entry.time
				? new Date(entry.time as string)
				: new Date();
	return t.toLocaleString("zh-CN");
}

export const Route = createFileRoute("/admin/_admin/logs/")({
	component: LogsPage,
	loader: async () => {
		const [result, dates] = await Promise.all([
			searchLogsFn({ data: { page: 1, pageSize: 20 } }),
			getDatesFn(),
		]);
		return { result, availableDates: dates };
	},
});

function LogsPage() {
	const initial = Route.useLoaderData();
	const [result, setResult] = useState<LogQueryResult>(initial.result);
	const [availableDates] = useState<string[]>(initial.availableDates);
	const [page, setPage] = useState(1);
	const [pageSize] = useState(20);
	const [form] = Form.useForm();

	/** 执行日志搜索 */
	const doSearch = async (p = 1) => {
		const values = form.getFieldsValue();
		// DatePicker.RangePicker 的值为 dayjs 对象数组，需转为字符串
		const dateRange: [unknown, unknown] | undefined = values.dateRange;
		const startDate = dateRange?.[0]
			? (dateRange[0] as { format: (f: string) => string }).format("YYYY-MM-DD")
			: "";
		const endDate = dateRange?.[1]
			? (dateRange[1] as { format: (f: string) => string }).format("YYYY-MM-DD")
			: "";

		try {
			const data = await searchLogsFn({
				data: {
					keyword: values.keyword || undefined,
					level: values.level || undefined,
					startDate: startDate || undefined,
					endDate: endDate || undefined,
					page: p,
					pageSize,
				},
			});
			setResult(data);
			setPage(p);
		} catch {
			message.error("日志查询失败，请稍后重试");
		}
	};

	/** 重置筛选条件并重新搜索 */
	const handleReset = () => {
		form.resetFields();
		doSearch();
	};

	/** 点击日期标签快速搜索 */
	const handleDateClick = (date: string) => {
		// 绕过 dayjs 对象，直接发起搜索
		searchLogsFn({
			data: { startDate: date, endDate: date, page: 1, pageSize },
		})
			.then((data) => {
				setResult(data);
				setPage(1);
			})
			.catch(() => {
				message.error("日志查询失败，请稍后重试");
			});
	};

	/** 将 entry 转为 Table dataSource 可用的记录，追加唯一 key */
	const dataSource = result.entries.map((entry, idx) => ({
		...entry,
		_rowKey: `${result.page}-${idx}`,
	}));

	const columns = [
		{
			title: "时间",
			dataIndex: "time",
			key: "time",
			width: 180,
			render: (_: unknown, record: LogEntry) => formatTime(record),
		},
		{
			title: "级别",
			dataIndex: "level",
			key: "level",
			width: 90,
			render: (level: string) => (
				<Tag color={LEVEL_COLORS[level] || "default"}>
					{level.toUpperCase()}
				</Tag>
			),
		},
		{
			title: "消息内容",
			dataIndex: "msg",
			key: "msg",
			ellipsis: true,
			render: (msg: string | undefined) => msg ?? "",
		},
	];

	return (
		<div>
			<h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
				日志查询
			</h1>
			<p style={{ marginBottom: 16, color: "var(--ant-color-text-tertiary)" }}>
				搜索和查看系统操作日志文件
			</p>

			{/* 搜索表单 */}
			<Form
				form={form}
				layout="inline"
				onFinish={() => doSearch()}
				style={{ marginBottom: 12, flexWrap: "wrap", gap: 8 }}
			>
				<Form.Item name="keyword" label="关键词">
					<Input placeholder="搜索日志..." allowClear style={{ width: 180 }} />
				</Form.Item>

				<Form.Item name="level" label="级别">
					<Select options={LEVEL_OPTIONS} style={{ width: 110 }} />
				</Form.Item>

				<Form.Item name="dateRange" label="日期范围">
					<DatePicker.RangePicker
						placeholder={["开始日期", "结束日期"]}
						format="YYYY-MM-DD"
						style={{ width: 260 }}
					/>
				</Form.Item>

				<Form.Item>
					<Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
						搜索
					</Button>
				</Form.Item>

				<Form.Item>
					<Button icon={<ReloadOutlined />} onClick={handleReset}>
						重置
					</Button>
				</Form.Item>
			</Form>

			{/* 可用日期快速选择 */}
			{availableDates.length > 0 && (
				<div
					style={{
						marginBottom: 16,
						display: "flex",
						flexWrap: "wrap",
						gap: 6,
						alignItems: "center",
					}}
				>
					<span
						style={{ fontSize: 12, color: "var(--ant-color-text-tertiary)" }}
					>
						日志日期：
					</span>
					{availableDates.slice(0, 14).map((d: string) => (
						<Tag
							key={d}
							color="default"
							style={{ cursor: "pointer", margin: 0 }}
							onClick={() => handleDateClick(d)}
						>
							{d}
						</Tag>
					))}
				</div>
			)}

			{/* 日志结果表格 */}
			<Table
				dataSource={dataSource}
				columns={columns}
				rowKey="_rowKey"
				locale={{
					emptyText: (
						<div style={{ padding: "32px 0" }}>
							<FileTextOutlined
								style={{
									fontSize: 32,
									color: "var(--ant-color-text-quaternary)",
									marginBottom: 8,
								}}
							/>
							<p style={{ color: "var(--ant-color-text-tertiary)" }}>
								{result.total === 0 ? "暂无日志" : "未找到匹配"}
							</p>
						</div>
					),
				}}
				pagination={{
					total: result.total,
					current: page,
					pageSize,
					showSizeChanger: false,
					showTotal: (total, range) =>
						`第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
					onChange: (p: number) => doSearch(p),
				}}
			/>
		</div>
	);
}
