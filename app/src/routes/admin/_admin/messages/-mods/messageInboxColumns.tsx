/**
 * 消息收件箱表格列定义
 * 只读列表：类型 / 状态用 StatusTag，时间列走 ProTable valueType，行内提供已读与删除
 */
import { CheckOutlined } from "@ant-design/icons";
import {
	StatusTag,
	type StatusTagOption,
	TableOperate,
} from "@fsdx/ui-spa/table";
import { Button } from "antd";
import type { MessageRecord } from "#/services/message/message.server";

/** 消息类型展示选项 */
const TYPE_OPTIONS: Record<string, StatusTagOption> = {
	system: { label: "系统", tone: "info" },
};

/** 消息状态展示选项 */
const STATUS_OPTIONS: Record<string, StatusTagOption> = {
	unread: { label: "未读", tone: "danger" },
	read: { label: "已读", tone: "neutral" },
};

interface MessageInboxColumnsOptions {
	/** 标记单条已读 */
	onMarkRead: (record: MessageRecord) => Promise<void>;
	/** 删除单条消息 */
	onDelete: (record: MessageRecord) => Promise<void>;
}

export function messageInboxColumns(options: MessageInboxColumnsOptions) {
	return [
		{
			title: "类型",
			dataIndex: "type",
			key: "type",
			width: 100,
			render: (val: string) => <StatusTag value={val} options={TYPE_OPTIONS} />,
		},
		{
			title: "标题",
			dataIndex: "title",
			key: "title",
			ellipsis: true,
		},
		{
			title: "状态",
			dataIndex: "status",
			key: "status",
			width: 100,
			render: (val: string) => (
				<StatusTag value={val} options={STATUS_OPTIONS} />
			),
		},
		{
			title: "时间",
			dataIndex: "createdAt",
			key: "createdAt",
			width: 160,
			valueType: "dateTimeMinute",
		},
		{
			title: "操作",
			key: "actions",
			fixed: "right" as const,
			// 操作列固定右侧必须显式声明宽度（2 项 → 160）
			width: 160,
			render: (_: unknown, record: MessageRecord) => (
				<TableOperate>
					{record.status === "unread" && (
						<TableOperate.Custom>
							<Button
								type="link"
								size="small"
								icon={<CheckOutlined />}
								onClick={() => void options.onMarkRead(record)}
							>
								已读
							</Button>
						</TableOperate.Custom>
					)}
					<TableOperate.Delete
						recordName="该消息"
						onConfirm={() => options.onDelete(record)}
					/>
				</TableOperate>
			),
		},
	];
}
