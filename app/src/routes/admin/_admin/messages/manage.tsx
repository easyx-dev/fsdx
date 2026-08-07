/**
 * 管理端消息管理页面：全量消息列表 + 向用户发送消息
 */
import {
	ReloadOutlined,
	SearchOutlined,
	SendOutlined,
} from "@ant-design/icons";
import { message } from "@fsdx/ui-spa/antd-static";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Form, Input, Select, Table } from "antd";
import { useCallback, useEffect, useState } from "react";
import { AdminPageContent } from "#/components/admin";
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
import { messageManageColumns } from "./-mods/messageManageColumns";
import { SendMessageModal } from "./-mods/SendMessageModal";

export const Route = createFileRoute("/admin/_admin/messages/manage")({
	component: MessageManagePage,
});

const PAGE_SIZE = 20;

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

	const columns = messageManageColumns({ onDelete: handleDelete });

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
					showTotal: (total: number, range: [number, number]) =>
						`第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
					onChange: (p: number) => doSearch(p),
				}}
			/>

			{/* 发送消息弹窗 */}
			<SendMessageModal
				open={sendOpen}
				sending={sending}
				form={sendForm}
				recipientOptions={recipientOptions}
				recipientSearching={recipientSearching}
				onRecipientTypeChange={handleRecipientTypeChange}
				onRecipientSearch={(keyword: string) => fetchRecipients(keyword)}
				onOk={handleSend}
				onCancel={() => setSendOpen(false)}
			/>
		</AdminPageContent>
	);
}
