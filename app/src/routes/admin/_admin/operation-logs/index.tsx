/**
 * 操作日志查询页面：antd Form + ProTable 实现操作审计日志的搜索、筛选与分页
 */
import {
	FileTextOutlined,
	ReloadOutlined,
	SearchOutlined,
} from "@ant-design/icons";
import { AdminPageContent } from "@fsdx/ui-spa/admin-page-content";
import { ProTable } from "@fsdx/ui-spa/pro-table";
import { createFileRoute } from "@tanstack/react-router";
import { Button, DatePicker, Form, Input, Select, Tag } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { useState } from "react";
import { message } from "#/components/antd-static";
import type { SortOrder } from "#/types/query";
import {
	getOperationLogModulesSFn,
	type JsonValue,
	searchOperationLogsSFn,
} from "./-mods/operation-logs.functions";

/** 可序列化的操作日志条目 */
interface OperationLogEntry {
	id: string;
	operatorId: string | null;
	operatorName: string;
	module: string;
	action: string;
	targetType: string;
	targetId: string | null;
	targetName: string | null;
	detail: JsonValue;
	createdAt: string;
}

/** 模块对应 Tag 颜色 */
const MODULE_COLORS: Record<string, string> = {
	news: "blue",
	admin: "purple",
	client: "cyan",
	"admin-role": "orange",
	dict: "green",
	config: "geekblue",
	file: "lime",
	"file-explorer": "lime",
	translation: "magenta",
};

/** 动作对应 Tag 颜色 */
const ACTION_COLORS: Record<string, string> = {
	create: "green",
	update: "blue",
	delete: "red",
	change_status: "gold",
	reset_pwd: "orange",
	export: "cyan",
	import: "purple",
	upload: "geekblue",
	make_permanent: "lime",
	login: "cyan",
	request: "geekblue",
};

/** 模块中文名映射 */
const MODULE_LABELS: Record<string, string> = {
	news: "新闻",
	admin: "管理员",
	client: "客户端用户",
	"admin-role": "角色",
	dict: "字典",
	config: "系统配置",
	file: "文件",
	"file-explorer": "文件资源管理器",
	translation: "翻译",
};

/** 动作中文名映射 */
const ACTION_LABELS: Record<string, string> = {
	create: "创建",
	update: "更新",
	delete: "删除",
	change_status: "状态变更",
	reset_pwd: "重置密码",
	export: "导出",
	import: "导入",
	upload: "上传",
	make_permanent: "转为永久",
	login: "登录",
	request: "外部请求",
};

export const Route = createFileRoute("/admin/_admin/operation-logs/")({
	component: OperationLogsPage,
	loader: async () => {
		const [modules, result] = await Promise.all([
			getOperationLogModulesSFn(),
			searchOperationLogsSFn({ data: { page: 1, pageSize: 20 } }),
		]);
		return { modules, result };
	},
});

function OperationLogsPage() {
	const initial = Route.useLoaderData();
	const [result, setResult] = useState(initial.result);
	const [modules] = useState<string[]>(initial.modules);
	const [page, setPage] = useState(1);
	const [pageSize] = useState(20);
	const [form] = Form.useForm();
	const [sortField, setSortField] = useState<string | undefined>();
	const [sortOrder, setSortOrder] = useState<SortOrder | undefined>();

	/** 执行搜索 */
	const doSearch = async (p?: number, sf?: string, so?: SortOrder) => {
		const targetPage = p ?? page;
		const field = sf !== undefined ? sf : sortField;
		const order = so !== undefined ? so : sortOrder;
		const values = form.getFieldsValue();
		const dateRange: [Dayjs, Dayjs] | undefined = values.dateRange;
		const startDate = dateRange?.[0]
			? dateRange[0].format("YYYY-MM-DD")
			: undefined;
		const endDate = dateRange?.[1]
			? dateRange[1].format("YYYY-MM-DD")
			: undefined;

		try {
			const data = await searchOperationLogsSFn({
				data: {
					module: values.module || undefined,
					action: values.action || undefined,
					keyword: values.keyword || undefined,
					startDate,
					endDate,
					page: targetPage,
					pageSize,
					sortField: field,
					sortOrder: order,
				},
			});
			setResult(data);
			setPage(targetPage);
		} catch {
			message.error("查询失败，请稍后重试");
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
		doSearch(undefined, s.field, s.order as SortOrder | undefined);
	};

	/** 重置筛选条件 */
	const handleReset = () => {
		form.resetFields();
		doSearch();
	};

	const dataSource = result.records.map(
		(entry: OperationLogEntry, idx: number) => ({
			...entry,
			_rowKey: `${result.page}-${idx}`,
			createdAt: new Date(entry.createdAt),
		}),
	);

	const moduleOptions = [
		{ label: "全部", value: "" },
		...modules.map((m) => ({ label: MODULE_LABELS[m] ?? m, value: m })),
	];

	const actionOptions = [
		{ label: "全部", value: "" },
		...Object.entries(ACTION_LABELS).map(([value, label]) => ({
			label,
			value,
		})),
	];

	const columns = [
		{
			title: "时间",
			dataIndex: "createdAt",
			key: "createdAt",
			width: 180,
			sorter: true,
			sortOrder: sortField === "createdAt" ? sortOrder : undefined,
			render: (_: unknown, record: Record<string, unknown>) =>
				dayjs(record.createdAt as Date).format("YYYY-MM-DD HH:mm"),
		},
		{
			title: "操作人",
			dataIndex: "operatorName",
			key: "operatorName",
			width: 130,
		},
		{
			title: "模块",
			dataIndex: "module",
			key: "module",
			width: 110,
			render: (v: string) => (
				<Tag color={MODULE_COLORS[v] || "default"}>{MODULE_LABELS[v] ?? v}</Tag>
			),
		},
		{
			title: "动作",
			dataIndex: "action",
			key: "action",
			width: 100,
			render: (v: string) => (
				<Tag color={ACTION_COLORS[v] || "default"}>{ACTION_LABELS[v] ?? v}</Tag>
			),
		},
		{
			title: "目标",
			dataIndex: "targetName",
			key: "targetName",
			ellipsis: true,
			render: (v: string | null) => v ?? "—",
		},
	];

	return (
		<AdminPageContent
			title="操作日志"
			description="查看管理员的所有数据变更操作记录"
		>
			{/* 搜索表单 */}
			<Form
				form={form}
				layout="inline"
				onFinish={() => doSearch()}
				style={{ marginBottom: 16, flexWrap: "wrap", gap: 8 }}
			>
				<Form.Item name="module" label="模块">
					<Select options={moduleOptions} style={{ width: 130 }} />
				</Form.Item>

				<Form.Item name="action" label="动作">
					<Select options={actionOptions} style={{ width: 130 }} />
				</Form.Item>

				<Form.Item name="keyword" label="关键词">
					<Input
						placeholder="搜索操作人/目标..."
						allowClear
						style={{ width: 200 }}
					/>
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

			{/* 结果表格 */}
			<ProTable
				dataSource={dataSource}
				columns={columns}
				rowKey="_rowKey"
				onChange={handleTableChange}
				expandable={{
					expandedRowRender: (record: Record<string, unknown>) => (
						<pre
							style={{
								maxHeight: 300,
								overflow: "auto",
								padding: 12,
								fontSize: 12,
								backgroundColor: "var(--ant-color-fill-tertiary)",
								borderRadius: 6,
								margin: 0,
							}}
						>
							{JSON.stringify(record, null, 2)}
						</pre>
					),
					rowExpandable: () => true,
				}}
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
								{result.total === 0 ? "暂无操作日志" : "未找到匹配"}
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
		</AdminPageContent>
	);
}
