/**
 * 消息管理表格列定义
 */
import { TableOperate } from "@fsdx/ui-spa/table";
import { Tag } from "antd";
import dayjs from "dayjs";
import { MESSAGE_TYPE_LABELS } from "#/constants/message-types";
import type { MessageWithUser } from "#/services/message/message.server";

/** 用户类型展示映射 */
const USER_TYPE_LABELS: Record<string, string> = {
	admin: "管理端",
	client: "客户端",
};

/** 用户类型 Tag 颜色 */
const USER_TYPE_COLORS: Record<string, string> = {
	admin: "purple",
	client: "cyan",
};

/** 消息状态 Tag 颜色 */
const STATUS_COLORS: Record<string, string> = {
	unread: "red",
	read: "default",
};

interface MessageManageColumnsOptions {
	onDelete: (id: string) => void;
}

/** 消息管理表格列：用户/标题/类型/状态/时间 + 删除 */
export function messageManageColumns(options: MessageManageColumnsOptions) {
	return [
		{
			title: "用户",
			dataIndex: "userName",
			key: "userName",
			width: 200,
			render: (name: string, record: MessageWithUser) => (
				<>
					<Tag color={USER_TYPE_COLORS[record.userType]}>
						{USER_TYPE_LABELS[record.userType]}
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
			render: (v: string) => MESSAGE_TYPE_LABELS[v] ?? v,
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
			render: (_: unknown, record: MessageWithUser) => (
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
