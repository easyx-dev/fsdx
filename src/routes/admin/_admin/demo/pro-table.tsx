/**
 * ProTable 增强功能演示页面
 * 展示 valueType、renderText、renderCopyableText、ellipsis Tooltip、copyable 等特性
 */
import { createFileRoute } from "@tanstack/react-router";
import { Tag } from "antd";
import { useMemo } from "react";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import type { ProColumnType } from "#/components/admin/ProTable";
import { ProTable } from "#/components/admin/ProTable";

export const Route = createFileRoute("/admin/_admin/demo/pro-table")({
	component: ProTableDemoPage,
});

/** 模拟数据 */
interface DemoRecord {
	id: string;
	name: string;
	description: string;
	createdAt: string;
	updatedAt: string;
	email: string;
	url: string;
	tags: string;
}

const MOCK_DATA: DemoRecord[] = [
	{
		id: "1",
		name: "产品发布通知",
		description:
			"这是一段非常长的描述文本用于测试 ellipsis 的 Tooltip 效果，当列宽不足以完整显示时，应该出现省略号并且鼠标悬浮时显示完整内容",
		createdAt: "2025-03-15T09:30:00.000Z",
		updatedAt: "2026-06-01T14:25:30.000Z",
		email: "admin@example.com",
		url: "https://www.example.com/products/detail/12345?ref=admin&tab=info",
		tags: "重要,公告,产品",
	},
	{
		id: "2",
		name: "系统维护通知",
		description:
			"系统将于本周六凌晨进行例行维护升级，请各位用户提前保存工作内容并退出系统，维护期间所有服务暂停使用，预计持续三小时",
		createdAt: "2025-06-20T08:00:00.000Z",
		updatedAt: "2025-06-22T10:15:45.000Z",
		email: "support@company.co",
		url: "https://www.example.com/notices/system-maintenance",
		tags: "系统,维护,通知",
	},
	{
		id: "3",
		name: "简讯",
		description: "短文本",
		createdAt: "2026-01-01T00:00:00.000Z",
		updatedAt: "2026-01-01T00:00:00.000Z",
		email: "news@example.com",
		url: "https://short.link/x",
		tags: "新闻",
	},
];

function ProTableDemoPage() {
	const columns: ProColumnType<DemoRecord>[] = useMemo(
		() => [
			{
				title: "名称",
				dataIndex: "name",
				key: "name",
				width: 140,
				valueType: "text",
			},
			{
				title: "创建时间",
				dataIndex: "createdAt",
				key: "createdAt",
				width: 180,
				valueType: "dateTime",
			},
			{
				title: "更新时间",
				dataIndex: "updatedAt",
				key: "updatedAt",
				width: 180,
				valueType: "dateTime",
			},
			{
				title: "描述(ellipsis)",
				dataIndex: "description",
				key: "description",
				width: 200,
				ellipsis: true,
			},
			{
				title: "描述(renderText)",
				dataIndex: "description",
				key: "descriptionRenderText",
				width: 200,
				ellipsis: true,
				renderText: (val: unknown) =>
					typeof val === "string" ? `[摘要] ${val.slice(0, 30)}...` : "",
			},
			{
				title: "邮箱(copyable)",
				dataIndex: "email",
				key: "email",
				width: 180,
				copyable: true,
			},
			{
				title: "链接(renderCopyableText)",
				dataIndex: "url",
				key: "url",
				width: 200,
				ellipsis: true,
				copyable: true,
				renderText: (val: unknown) => {
					const url = typeof val === "string" ? val : "";
					try {
						return new URL(url).hostname;
					} catch {
						return url;
					}
				},
				renderCopyableText: (val: unknown) =>
					typeof val === "string" ? val : "",
			},
			{
				title: "标签",
				dataIndex: "tags",
				key: "tags",
				width: 180,
				render: (val: unknown) => {
					const tags = typeof val === "string" ? val.split(",") : [];
					return (
						<span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
							{tags.map((tag) => (
								<Tag key={tag} color="blue">
									{tag}
								</Tag>
							))}
						</span>
					);
				},
			},
		],
		[],
	);

	return (
		<AdminPageContent
			title="ProTable 演示"
			description="展示 valueType、renderText、renderCopyableText、ellipsis Tooltip、copyable 等增强特性"
		>
			<ProTable<DemoRecord>
				columns={columns}
				dataSource={MOCK_DATA}
				rowKey="id"
				pagination={false}
			/>
		</AdminPageContent>
	);
}
