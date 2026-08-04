/**
 * 管理端消息管理页面：全量消息列表 + 向用户发送消息
 */
import {
	ReloadOutlined,
	SearchOutlined,
	SendOutlined,
} from "@ant-design/icons";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Form, Input, Modal, Radio, Select, Table, Tag } from "antd";
import dayjs from "dayjs";
import { useCallback, useEffect, useState } from "react";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import { TableOperate } from "#/components/admin/TableOperate";
import { message } from "#/components/antd-static";
import {
	deleteAnyMessageSFn,
	listAllMessagesSFn,
	searchRecipientsSFn,
	sendMessageSFn,
} from "#/services/message/message.functions";
import type {
	MessageWithRecipient,
	RecipientOption,
} from "#/services/message/message.server";
export const Route = createFileRoute("/admin/_admin/messages/manage")({
	component: MessageManagePage,
});

const PAGE_SIZE = 20;

/** 接收者类型展示映射 */
const RECIPIENT_TYPE_LABELS: Record<string, string> = {
	admin: "管理端",
	client: "客户端",
};

/** 接收者类型 Tag 颜色 */
const RECIPIENT_TYPE_COLORS: Record<string, string> = {
	admin: "purple",
	client: "cyan",
};

/** 消息状态 Tag 颜色 */
const STATUS_COLORS: Record<string, string> = {
	unread: "red",
	read: "default",
};

/** 消息类型展示映射 */
const TYPE_LABELS: Record<string, string> = {
	system: "系统",
	ppt: "PPT",
	task: "任务",
};

interface MessageManageFormValues {
	recipientType?: "admin" | "client";
	status?: "unread" | "read";
	keyword?: string;
}

interface SendMessageFormValues {
	recipientType: "admin" | "client";
	recipientIds: string[];
	title: string;
	content?: string;
	type?: string;
	relatedLink?: string;
}

function MessageManagePage() {
	const [result, setResult] = useState<{
		records: MessageWithRecipient[];
		total: number;
		page: number;
		pageSize: number;
	}>({ records: [], total: 0, page: 1, pageSize: PAGE_SIZE });
	const [loading, setLoading] = useState(false);
	const [page, setPage] = useState(1);
	const [searchForm] = Form.useForm<MessageManageFormValues>();

	const [sendOpen, setSendOpen] = useState(false);
	const [sending, setSending] = useState(false);
	const [sendForm] = Form.useForm<SendMessageFormValues>();
	const [recipientOptions, setRecipientOptions] = useState<RecipientOption[]>(
		[],
	);
	const [recipientSearching, setRecipientSearching] = useState(false);

	/** 执行列表查询 */
	const doSearch = useCallback(
		async (targetPage = 1) => {
			setLoading(true);
			try {
				const values = searchForm.getFieldsValue();
				const data = await listAllMessagesSFn({
					data: {
						recipientType: values.recipientType || undefined,
						status: values.status || undefined,
						keyword: values.keyword || undefined,
						page: targetPage,
						pageSize: PAGE_SIZE,
					},
				});
				setResult(data);
				setPage(targetPage);
			} catch {
				message.error("查询失败，请稍后重试");
			} finally {
				setLoading(false);
			}
		},
		[searchForm],
	);

	useEffect(() => {
		doSearch();
	}, [doSearch]);

	/** 重置筛选条件 */
	const handleReset = () => {
		searchForm.resetFields();
		doSearch();
	};

	/** 加载收件人候选（发送消息选择器数据源） */
	const fetchRecipients = useCallback(
		async (keyword?: string) => {
			const recipientType = sendForm.getFieldValue("recipientType") ?? "client";
			setRecipientSearching(true);
			try {
				const options = await searchRecipientsSFn({
					data: { recipientType, keyword: keyword || undefined },
				});
				setRecipientOptions(options);
			} catch {
				setRecipientOptions([]);
			} finally {
				setRecipientSearching(false);
			}
		},
		[sendForm],
	);

	/** 打开发送弹窗并加载初始候选 */
	const openSendModal = () => {
		sendForm.resetFields();
		setRecipientOptions([]);
		setSendOpen(true);
		fetchRecipients();
	};

	/** 切换接收者类型时重新加载候选 */
	const handleRecipientTypeChange = () => {
		sendForm.setFieldValue("recipientIds", []);
		setRecipientOptions([]);
		fetchRecipients();
	};

	/** 提交发送消息 */
	const handleSend = async () => {
		const values = await sendForm.validateFields();
		setSending(true);
		try {
			const { count } = await sendMessageSFn({ data: { ...values } });
			message.success(`已向 ${count} 位用户发送消息`);
			setSendOpen(false);
			doSearch();
		} catch {
			message.error("发送失败，请稍后重试");
		} finally {
			setSending(false);
		}
	};

	/** 删除任意消息 */
	const handleDelete = async (id: string) => {
		try {
			await deleteAnyMessageSFn({ data: { id } });
			message.success("已删除");
			doSearch();
		} catch {
			message.error("删除失败，请稍后重试");
		}
	};

	const columns = [
		{
			title: "接收者",
			dataIndex: "recipientName",
			key: "recipientName",
			width: 200,
			render: (name: string, record: MessageWithRecipient) => (
				<>
					<Tag color={RECIPIENT_TYPE_COLORS[record.recipientType]}>
						{RECIPIENT_TYPE_LABELS[record.recipientType]}
					</Tag>
					{name}
				</>
			),
		},
		{
			title: "标题",
			dataIndex: "title",
			key: "title",
			ellipsis: true,
		},
		{
			title: "类型",
			dataIndex: "type",
			key: "type",
			width: 90,
			render: (v: string) => TYPE_LABELS[v] ?? v,
		},
		{
			title: "状态",
			dataIndex: "status",
			key: "status",
			width: 90,
			render: (v: string) => (
				<Tag color={STATUS_COLORS[v] ?? "default"}>
					{v === "unread" ? "未读" : "已读"}
				</Tag>
			),
		},
		{
			title: "时间",
			dataIndex: "createdAt",
			key: "createdAt",
			width: 180,
			render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm"),
		},
		{
			title: "操作",
			key: "action",
			width: 100,
			render: (_: unknown, record: MessageWithRecipient) => (
				<TableOperate>
					<TableOperate.Delete
						recordName="该消息"
						onConfirm={() => handleDelete(record.id)}
					/>
				</TableOperate>
			),
		},
	];

	return (
		<AdminPageContent
			title="消息管理"
			description="查看全部用户消息，并向管理端或客户端用户发送通知"
			extra={
				<Button type="primary" icon={<SendOutlined />} onClick={openSendModal}>
					发送消息
				</Button>
			}
		>
			{/* 筛选栏 */}
			<Form
				form={searchForm}
				layout="inline"
				onFinish={() => doSearch()}
				style={{ marginBottom: 16, flexWrap: "wrap", gap: 8 }}
			>
				<Form.Item name="recipientType" label="接收者类型">
					<Select
						options={[
							{ label: "全部", value: "" },
							{ label: "管理端", value: "admin" },
							{ label: "客户端", value: "client" },
						]}
						style={{ width: 130 }}
					/>
				</Form.Item>

				<Form.Item name="status" label="状态">
					<Select
						options={[
							{ label: "全部", value: "" },
							{ label: "未读", value: "unread" },
							{ label: "已读", value: "read" },
						]}
						style={{ width: 110 }}
					/>
				</Form.Item>

				<Form.Item name="keyword" label="关键词">
					<Input
						placeholder="搜索消息标题..."
						allowClear
						style={{ width: 200 }}
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

			{/* 消息列表 */}
			<Table
				rowKey="id"
				loading={loading}
				columns={columns}
				dataSource={result.records}
				pagination={{
					total: result.total,
					current: page,
					pageSize: PAGE_SIZE,
					showSizeChanger: false,
					showTotal: (total, range) =>
						`第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
					onChange: (p: number) => doSearch(p),
				}}
			/>

			{/* 发送消息弹窗 */}
			<Modal
				title="发送消息"
				open={sendOpen}
				onOk={handleSend}
				onCancel={() => setSendOpen(false)}
				confirmLoading={sending}
				okText="发送"
				cancelText="取消"
				width={520}
			>
				<Form
					form={sendForm}
					layout="vertical"
					initialValues={{ recipientType: "client" }}
				>
					<Form.Item
						name="recipientType"
						label="接收者类型"
						rules={[{ required: true, message: "请选择接收者类型" }]}
					>
						<Radio.Group onChange={handleRecipientTypeChange}>
							<Radio value="client">客户端用户</Radio>
							<Radio value="admin">管理端用户</Radio>
						</Radio.Group>
					</Form.Item>

					<Form.Item
						name="recipientIds"
						label="接收者"
						rules={[{ required: true, message: "请选择接收者" }]}
					>
						<Select
							mode="multiple"
							placeholder="输入用户名或邮箱搜索，可多选"
							options={recipientOptions}
							loading={recipientSearching}
							onSearch={(value) => fetchRecipients(value)}
							notFoundContent={recipientSearching ? null : "未找到匹配用户"}
							filterOption={false}
							showSearch
							optionFilterProp="label"
							style={{ width: "100%" }}
						/>
					</Form.Item>

					<Form.Item
						name="title"
						label="标题"
						rules={[{ required: true, message: "请输入标题" }]}
					>
						<Input placeholder="消息标题（必填）" maxLength={200} />
					</Form.Item>

					<Form.Item name="content" label="内容">
						<Input.TextArea
							rows={3}
							placeholder="消息内容（选填）"
							maxLength={2000}
							showCount
						/>
					</Form.Item>

					<Form.Item name="type" label="消息类型">
						<Input placeholder="如 system / ppt / task（默认 system）" />
					</Form.Item>

					<Form.Item name="relatedLink" label="相关链接">
						<Input placeholder="跳转链接（选填）" />
					</Form.Item>
				</Form>
			</Modal>
		</AdminPageContent>
	);
}
