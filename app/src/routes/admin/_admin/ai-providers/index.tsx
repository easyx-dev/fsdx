/**
 * AI 厂商管理页面：多厂商配置 CRUD（底层均为 OpenAI 兼容协议）
 */
import { PlusOutlined } from "@ant-design/icons";
import { message } from "@fsdx/ui-spa/antd-static";
import { TableOperate } from "@fsdx/ui-spa/table";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Card, Table, Tag, Tooltip, Typography } from "antd";
import { useState } from "react";
import { AdminPageContent } from "#/components/admin";
import type { AiProviderConfig } from "#/services/ai/ai.schemas";
import {
	getAiProvidersSFn,
	saveAiProvidersSFn,
} from "#/services/ai/ai-providers.functions";
import { AiProviderFormModal } from "./-mods/AiProviderFormModal";

const { Text } = Typography;

export const Route = createFileRoute("/admin/_admin/ai-providers/")({
	component: AiProvidersPage,
	loader: async () => await getAiProvidersSFn(),
});

function AiProvidersPage() {
	const loaderData = Route.useLoaderData();
	const [providers, setProviders] = useState<AiProviderConfig[]>(loaderData);
	const [modalOpen, setModalOpen] = useState(false);
	const [editing, setEditing] = useState<AiProviderConfig | null>(null);

	const save = async (next: AiProviderConfig[]) => {
		try {
			await saveAiProvidersSFn({ data: { providers: next } });
			setProviders(next);
			message.success("AI 厂商配置已保存");
		} catch (err) {
			message.error(err instanceof Error ? err.message : "保存失败");
		}
	};

	const handleSubmit = (provider: AiProviderConfig) => {
		let next: AiProviderConfig[];
		const exists = providers.some((p) => p.id === provider.id);
		if (exists) {
			next = providers.map((p) => (p.id === provider.id ? provider : p));
		} else {
			next = [...providers, provider];
		}
		// 仅保留一个默认；新增/编辑设为默认时取消其它 default
		if (provider.default) {
			next = next.map((p) => ({ ...p, default: p.id === provider.id }));
		} else if (!next.some((p) => p.default)) {
			// 无默认则让首个成为默认
			next = next.map((p, i) => ({ ...p, default: i === 0 }));
		}
		void save(next);
		setModalOpen(false);
		setEditing(null);
	};

	const handleDelete = (record: AiProviderConfig) => {
		const next = providers.filter((p) => p.id !== record.id);
		void save(next);
	};

	const handleSetDefault = (record: AiProviderConfig) => {
		const next = providers.map((p) => ({
			...p,
			default: p.id === record.id,
		}));
		void save(next);
	};

	const columns = [
		{ title: "厂商 ID", dataIndex: "id", key: "id", width: 140 },
		{ title: "名称", dataIndex: "name", key: "name", width: 140 },
		{
			title: "API 基础地址",
			dataIndex: "baseUrl",
			key: "baseUrl",
			render: (val: string) => <Text className="text-xs">{val}</Text>,
		},
		{ title: "模型名", dataIndex: "model", key: "model", width: 180 },
		{
			title: "默认",
			dataIndex: "default",
			key: "default",
			width: 90,
			render: (val: boolean) => (val ? <Tag color="blue">默认</Tag> : null),
		},
		{
			title: "操作",
			key: "actions",
			width: 200,
			render: (_: unknown, record: AiProviderConfig) => (
				<TableOperate>
					<TableOperate.Edit
						onClick={() => {
							setEditing(record);
							setModalOpen(true);
						}}
					/>
					<TableOperate.Custom>
						<Tooltip title="设为默认厂商">
							<Button
								type="link"
								size="small"
								disabled={!!record.default}
								onClick={() => handleSetDefault(record)}
							>
								设为默认
							</Button>
						</Tooltip>
					</TableOperate.Custom>
					<TableOperate.Delete
						recordName={`厂商 ${record.name}`}
						onConfirm={() => handleDelete(record)}
					/>
				</TableOperate>
			),
		},
	];

	return (
		<AdminPageContent
			title="AI 厂商管理"
			description="配置多个 OpenAI 兼容 API 厂商（DeepSeek / Moonshot / Qwen / 本地 vLLM 等），并指定默认厂商。"
		>
			<Card size="small">
				<div className="mb-3">
					<Button
						type="primary"
						icon={<PlusOutlined />}
						onClick={() => {
							setEditing(null);
							setModalOpen(true);
						}}
					>
						新增厂商
					</Button>
				</div>
				<Table
					rowKey="id"
					columns={columns}
					dataSource={providers}
					pagination={false}
					size="small"
					locale={{ emptyText: "尚未配置 AI 厂商，点击右上角「新增厂商」开始" }}
				/>
			</Card>
			<AiProviderFormModal
				open={modalOpen}
				editing={editing}
				onSubmit={handleSubmit}
				onCancel={() => {
					setModalOpen(false);
					setEditing(null);
				}}
			/>
		</AdminPageContent>
	);
}
