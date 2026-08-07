/**
 * 管理端个人收件箱页面：查看、已读、删除自己的消息
 */
import {
	CheckOutlined,
	DeleteOutlined,
	ExclamationCircleOutlined,
	FileTextOutlined,
	InfoCircleOutlined,
} from "@ant-design/icons";
import { message } from "@fsdx/ui-spa/antd-static";
import { createFileRoute } from "@tanstack/react-router";
import {
	Button,
	Empty,
	List,
	Pagination,
	Popconfirm,
	Space,
	Spin,
	Tabs,
	Tag,
	Typography,
} from "antd";
import { useCallback, useEffect, useState } from "react";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import {
	deleteAdminMessageSFn,
	getAdminMessagesSFn,
	getAdminUnreadCountSFn,
	markAdminMessageAsReadSFn,
	markAllAdminMessagesAsReadSFn,
} from "#/services/message/message.functions";
import type { MessageRecord } from "#/services/message/message.server";

const { Text, Paragraph } = Typography;

export const Route = createFileRoute("/admin/_admin/messages/")({
	component: AdminInboxPage,
});

const PAGE_SIZE = 10;

const messageTypeIcon: Record<string, React.ReactNode> = {
	ppt: <FileTextOutlined />,
	task: <ExclamationCircleOutlined />,
	system: <InfoCircleOutlined />,
};
const messageTypeColor: Record<string, string> = {
	ppt: "blue",
	task: "orange",
	system: "default",
};

function AdminInboxPage() {
	const [loading, setLoading] = useState(false);
	const [messages, setMessages] = useState<MessageRecord[]>([]);
	const [tab, setTab] = useState<"all" | "unread" | "read">("all");
	const [page, setPage] = useState(1);
	const [total, setTotal] = useState(0);
	const [unreadCount, setUnreadCount] = useState(0);

	const fetchMessages = useCallback(async () => {
		setLoading(true);
		try {
			const result = await getAdminMessagesSFn({
				data: {
					status: tab === "all" ? undefined : tab,
					page,
					pageSize: PAGE_SIZE,
				},
			});
			setMessages(result.records);
			setTotal(result.total);
		} catch (err) {
			// 列表加载失败不打扰用户，但保留排查痕迹
			console.warn("[admin-messages] 加载消息列表失败", err);
			setMessages([]);
			setTotal(0);
		} finally {
			setLoading(false);
		}
	}, [tab, page]);

	const fetchUnreadCount = useCallback(async () => {
		try {
			setUnreadCount(await getAdminUnreadCountSFn());
		} catch (err) {
			// 未读数为辅助信息，失败不打扰用户，但保留排查痕迹
			console.warn("[admin-messages] 获取未读数失败", err);
		}
	}, []);

	useEffect(() => {
		fetchMessages();
	}, [fetchMessages]);

	useEffect(() => {
		fetchUnreadCount();
	}, [fetchUnreadCount]);

	const handleMarkRead = async (id: string) => {
		await markAdminMessageAsReadSFn({ data: { id } });
		fetchMessages();
		fetchUnreadCount();
	};

	const handleMarkAllRead = async () => {
		await markAllAdminMessagesAsReadSFn();
		message.success("已全部标记为已读");
		fetchMessages();
		fetchUnreadCount();
	};

	const handleDelete = async (id: string) => {
		await deleteAdminMessageSFn({ data: { id } });
		message.success("已删除");
		fetchMessages();
		fetchUnreadCount();
	};

	const handleTabChange = (key: string) => {
		setTab(key as typeof tab);
		setPage(1);
	};

	const tabItems = [
		{ key: "all", label: "全部" },
		{
			key: "unread",
			label: (
				<Space size={4}>
					未读
					{unreadCount > 0 && (
						<Tag color="red" style={{ marginLeft: 4, borderRadius: "50%" }}>
							{unreadCount}
						</Tag>
					)}
				</Space>
			),
		},
		{ key: "read", label: "已读" },
	];

	return (
		<AdminPageContent
			title="我的消息"
			description="查看系统推送给你的通知消息"
			extra={
				unreadCount > 0 && (
					<Button
						type="link"
						icon={<CheckOutlined />}
						onClick={handleMarkAllRead}
					>
						全部已读
					</Button>
				)
			}
		>
			<Tabs activeKey={tab} onChange={handleTabChange} items={tabItems} />

			<Spin spinning={loading}>
				{messages.length === 0 && !loading ? (
					<Empty description="暂无消息" style={{ marginTop: 48 }} />
				) : (
					<>
						<List
							dataSource={messages}
							renderItem={(item) => (
								<List.Item
									key={item.id}
									style={{
										padding: "16px 0",
										backgroundColor:
											item.status === "unread"
												? "var(--ant-color-primary-bg)"
												: undefined,
									}}
								>
									<List.Item.Meta
										avatar={
											<Tag color={messageTypeColor[item.type] ?? "default"}>
												{messageTypeIcon[item.type] ?? <InfoCircleOutlined />}
											</Tag>
										}
										title={
											<Space>
												<Text strong={item.status === "unread"}>
													{item.title}
												</Text>
												{item.status === "unread" && (
													<Tag color="red">未读</Tag>
												)}
											</Space>
										}
										description={
											<>
												{item.content && (
													<Paragraph
														ellipsis={{ rows: 2 }}
														style={{ marginBottom: 8 }}
													>
														{item.content}
													</Paragraph>
												)}
												<Space size="small">
													<Text type="secondary" style={{ fontSize: 12 }}>
														{new Date(item.createdAt).toLocaleString("zh-CN")}
													</Text>
													{item.relatedLink && (
														<Button
															type="link"
															size="small"
															href={item.relatedLink}
															target="_blank"
														>
															查看详情
														</Button>
													)}
												</Space>
											</>
										}
									/>
									<Space>
										{item.status === "unread" && (
											<Button
												type="text"
												size="small"
												icon={<CheckOutlined />}
												onClick={() => handleMarkRead(item.id)}
											>
												已读
											</Button>
										)}
										<Popconfirm
											title="确定删除该消息？"
											onConfirm={() => handleDelete(item.id)}
										>
											<Button
												type="text"
												size="small"
												danger
												icon={<DeleteOutlined />}
											>
												删除
											</Button>
										</Popconfirm>
									</Space>
								</List.Item>
							)}
						/>
						{total > PAGE_SIZE && (
							<div style={{ marginTop: 24, textAlign: "center" }}>
								<Pagination
									current={page}
									pageSize={PAGE_SIZE}
									total={total}
									onChange={(p: number) => setPage(p)}
									showSizeChanger={false}
								/>
							</div>
						)}
					</>
				)}
			</Spin>
		</AdminPageContent>
	);
}
