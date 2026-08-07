/**
 * 消息管理表格列定义
 */
import { TableOperate } from "@fsdx/ui-spa/table";
import { Tag } from "antd";
import dayjs from "dayjs";
import type { MessageWithRecipient } from "#/services/message/message.server";

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

interface MessageManageColumnsOptions {
	onDelete: (id: string) => void;
}

/** 消息管理表格列：接收者/标题/类型/状态/时间 + 删除 */
export function messageManageColumns(options: MessageManageColumnsOptions) {
	return [
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
						onConfirm={() => options.onDelete(record.id)}
					/>
				</TableOperate>
			),
		},
	];
}
