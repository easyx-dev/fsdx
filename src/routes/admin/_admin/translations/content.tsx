/**
 * 实体翻译管理页：维护 content_translation 表
 */
import {
	DeleteOutlined,
	DownloadOutlined,
	EditOutlined,
	PlusOutlined,
} from "@ant-design/icons";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
	Button,
	Form,
	Input,
	Modal,
	message,
	Popconfirm,
	Select,
	Space,
	Tag,
} from "antd";
import { useEffect, useState } from "react";
import { z } from "zod";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import { EditorTypeSelect } from "#/components/admin/EditorTypeSelect";
import { JsonImportButton } from "#/components/admin/JsonImportButton";
import { ProTable } from "#/components/admin/ProTable";
import { downloadFile } from "#/lib/export/export.utils";
import { SUPPORTED_LOCALES } from "#/lib/i18n/i18n.types";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import {
	exportContentTranslationsFn,
	importContentTranslationsFn,
} from "#/server/i18n/i18n.functions";
import {
	deleteContentTranslation,
	listContentTranslations,
	upsertContentTranslation,
} from "#/server/i18n/i18n.server";

const formSchema = z.object({
	id: z.string().optional(),
	entityType: z.string().min(1),
	entityId: z.string().min(1),
	fieldName: z.string().min(1),
	locale: z.enum(SUPPORTED_LOCALES),
	value: z.string().min(1),
	valueType: z.string().optional(),
});

const getList = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_VIEW)])
	.inputValidator(
		z.object({
			entityType: z.string().optional(),
			locale: z.string().optional(),
			keyword: z.string().optional(),
			page: z.number().optional(),
		}),
	)
	.handler(async ({ data }) =>
		listContentTranslations(
			data as Parameters<typeof listContentTranslations>[0],
		),
	);

const saveFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_MANAGE)])
	.inputValidator(formSchema)
	.handler(async ({ data }) =>
		upsertContentTranslation(
			data as Parameters<typeof upsertContentTranslation>[0],
		),
	);

const deleteFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.TRANSLATION_MANAGE)])
	.inputValidator(z.object({ id: z.string().min(1) }))
	.handler(async ({ data }) => {
		await deleteContentTranslation(data.id);
		return { success: true };
	});

export const Route = createFileRoute("/admin/_admin/translations/content")({
	component: ContentTranslationPage,
	loader: async () => await getList({ data: {} }),
});

function ContentTranslationPage() {
	const initial = Route.useLoaderData();
	const [data, setData] = useState(initial);
	const [modalOpen, setModalOpen] = useState(false);
	const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
	const [filterEntityType, setFilterEntityType] = useState<
		string | undefined
	>();
	const [filterLocale, setFilterLocale] = useState<string | undefined>();
	const [filterKeyword, setFilterKeyword] = useState<string>("");
	// 防抖后的搜索关键字
	const [debouncedKeyword, setDebouncedKeyword] = useState<string>("");
	const [form] = Form.useForm();

	// 搜索关键字输入防抖（300ms）
	useEffect(() => {
		const timer = setTimeout(() => setDebouncedKeyword(filterKeyword), 300);
		return () => clearTimeout(timer);
	}, [filterKeyword]);

	// 筛选条件变更时重置到第一页并刷新
	useEffect(() => {
		async function doRefresh() {
			const result = await getList({
				data: {
					entityType: filterEntityType,
					locale: filterLocale,
					keyword: debouncedKeyword,
					page: 1,
				},
			});
			setData(result);
		}
		doRefresh();
	}, [filterEntityType, filterLocale, debouncedKeyword]);

	async function refresh() {
		const result = await getList({
			data: {
				entityType: filterEntityType,
				locale: filterLocale,
				keyword: debouncedKeyword,
				page: data.page,
			},
		});
		setData(result);
	}

	async function handleSubmit(values: Record<string, unknown>) {
		try {
			const parsed = formSchema.parse({ ...values, id: editing?.id });
			await saveFn({ data: parsed });
			message.success(editing ? "翻译已更新" : "翻译已创建");
			setModalOpen(false);
			setEditing(null);
			form.resetFields();
			await refresh();
		} catch (err: unknown) {
			message.error(err instanceof Error ? err.message : "操作失败");
		}
	}

	function openCreate() {
		setEditing(null);
		form.resetFields();
		form.setFieldsValue({
			locale: "en",
			valueType: "text",
			entityType: "news",
		});
		setModalOpen(true);
	}

	function openEdit(record: Record<string, unknown>) {
		setEditing(record);
		form.setFieldsValue(record);
		setModalOpen(true);
	}

	async function handleDelete(id: string) {
		try {
			await deleteFn({ data: { id } });
			message.success("翻译已删除");
			await refresh();
		} catch (err: unknown) {
			message.error(err instanceof Error ? err.message : "删除失败");
		}
	}

	/** 导出实体翻译数据（JSON） */
	async function handleExport() {
		try {
			const json = await exportContentTranslationsFn();
			const timestamp = new Date().toISOString().slice(0, 10);
			downloadFile(
				json,
				`content_translations_export_${timestamp}.json`,
				"application/json",
			);
			message.success("导出完成");
		} catch (err: unknown) {
			message.error(err instanceof Error ? err.message : "导出失败");
		}
	}
	const columns = [
		{
			title: "实体类型",
			dataIndex: "entityType",
			key: "entityType",
			width: 100,
			render: (v: string) => <Tag color="blue">{v}</Tag>,
		},
		{
			title: "实体 ID",
			dataIndex: "entityId",
			key: "entityId",
			width: 120,
			ellipsis: true,
		},
		{ title: "字段名", dataIndex: "fieldName", key: "fieldName", width: 100 },
		{
			title: "语言",
			dataIndex: "locale",
			key: "locale",
			width: 70,
			render: (v: string) => <Tag>{v.toUpperCase()}</Tag>,
		},
		{
			title: "翻译值",
			dataIndex: "value",
			key: "value",
			ellipsis: true,
			render: (v: string) => (
				<span className="text-sm">
					{v.slice(0, 80)}
					{v.length > 80 ? "…" : ""}
				</span>
			),
		},
		{
			title: "操作",
			key: "actions",
			width: 140,
			render: (_: unknown, record: Record<string, unknown>) => (
				<Space size={4}>
					<Button
						type="link"
						size="small"
						icon={<EditOutlined />}
						onClick={() => openEdit(record)}
					/>
					<Popconfirm
						title="确定删除？"
						onConfirm={() => handleDelete(record.id as string)}
					>
						<Button type="link" size="small" danger icon={<DeleteOutlined />} />
					</Popconfirm>
				</Space>
			),
		},
	];

	return (
		<AdminPageContent
			title="实体翻译管理"
			extra={
				<Space>
					<Button icon={<DownloadOutlined />} onClick={handleExport}>
						导出 JSON
					</Button>

					<JsonImportButton
						onImport={async (jsonString) => {
							const data = JSON.parse(jsonString);
							const result = await importContentTranslationsFn({
								data: { data },
							});
							message.success(
								`导入完成：新增 ${result.created} / 更新 ${result.updated}`,
							);
							await refresh();
						}}
					>
						导入 JSON
					</JsonImportButton>

					<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
						新增翻译
					</Button>
				</Space>
			}
		>
			<div className="mb-4">
				<Space>
					<Input.Search
						placeholder="搜索字段名或翻译值"
						allowClear
						style={{ width: 260 }}
						value={filterKeyword}
						onChange={(e) => setFilterKeyword(e.target.value)}
						onSearch={(v) => {
							setFilterKeyword(v);
							setDebouncedKeyword(v);
						}}
					/>
					<Select
						placeholder="实体类型"
						allowClear
						style={{ width: 120 }}
						value={filterEntityType}
						onChange={(v) => {
							setFilterEntityType(v);
						}}
						options={[{ label: "新闻", value: "news" }]}
					/>
					<Select
						placeholder="语言"
						allowClear
						style={{ width: 100 }}
						value={filterLocale}
						onChange={(v) => {
							setFilterLocale(v);
						}}
						options={SUPPORTED_LOCALES.map((l) => ({
							label: l.toUpperCase(),
							value: l,
						}))}
					/>
				</Space>
			</div>

			<ProTable
				dataSource={data.records}
				columns={columns}
				rowKey="id"
				pagination={{
					total: data.total,
					pageSize: data.pageSize,
					current: data.page,
					onChange: async (page) => {
						const r = await getList({
							data: {
								entityType: filterEntityType,
								locale: filterLocale,
								keyword: debouncedKeyword,
								page,
							},
						});
						setData(r);
					},
				}}
			/>

			<Modal
				title={editing ? "编辑翻译" : "新增翻译"}
				open={modalOpen}
				onCancel={() => {
					setModalOpen(false);
					setEditing(null);
					form.resetFields();
				}}
				onOk={() => form.submit()}
			>
				<Form form={form} layout="vertical" onFinish={handleSubmit}>
					<Form.Item
						name="entityType"
						label="实体类型"
						rules={[{ required: true }]}
					>
						<Select options={[{ label: "news", value: "news" }]} />
					</Form.Item>
					<Form.Item
						name="entityId"
						label="实体 ID"
						rules={[{ required: true }]}
					>
						<Input placeholder="UUID" />
					</Form.Item>
					<Form.Item
						name="fieldName"
						label="字段名"
						rules={[{ required: true }]}
					>
						<Input placeholder="例如：title" />
					</Form.Item>
					<Form.Item name="locale" label="语言" rules={[{ required: true }]}>
						<Select
							options={SUPPORTED_LOCALES.map((l) => ({
								label: l.toUpperCase(),
								value: l,
							}))}
						/>
					</Form.Item>
					<Form.Item name="value" label="翻译值" rules={[{ required: true }]}>
						<Input.TextArea rows={3} />
					</Form.Item>
					<Form.Item name="valueType" label="编辑器类型">
						<EditorTypeSelect />
					</Form.Item>
				</Form>
			</Modal>
		</AdminPageContent>
	);
}
