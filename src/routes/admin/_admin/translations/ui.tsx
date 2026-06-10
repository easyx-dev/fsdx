/**
 * UI 翻译管理页：维护 ui_translation 表
 */
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
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
import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import { ProTable } from "#/components/admin/ProTable";
import {
	EDITOR_TYPE_LABELS,
	EDITOR_TYPES,
} from "#/lib/editor-types/editor-types";
import { SUPPORTED_LOCALES } from "#/lib/i18n/i18n.types";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { permGuard } from "#/middleware/server-fn-auth";
import {
	deleteUITranslation,
	listUITranslations,
	upsertUITranslation,
} from "#/server/i18n/i18n.server";

// ── 表单 schema ──
const formSchema = z.object({
	id: z.string().optional(),
	locale: z.enum(SUPPORTED_LOCALES),
	key: z.string().min(1).max(300),
	value: z.string().min(1),
	valueType: z.string().optional(),
});

// ── Server Functions ──
const getList = createServerFn({ method: "GET" })
	.middleware([permGuard(PERMISSIONS.TRANSLATION_VIEW)])
	.inputValidator(
		z.object({
			locale: z.string().optional(),
			keyword: z.string().optional(),
			page: z.number().optional(),
		}),
	)
	.handler(async ({ data }) =>
		listUITranslations(data as Parameters<typeof listUITranslations>[0]),
	);

const saveFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.TRANSLATION_MANAGE)])
	.inputValidator(formSchema)
	.handler(async ({ data }) =>
		upsertUITranslation(data as Parameters<typeof upsertUITranslation>[0]),
	);

const deleteFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.TRANSLATION_MANAGE)])
	.inputValidator(z.object({ id: z.string().min(1) }))
	.handler(async ({ data }) => {
		await deleteUITranslation(data.id);
		return { success: true };
	});

export const Route = createFileRoute("/admin/_admin/translations/ui")({
	component: UITranslationPage,
	loader: async () => await getList({ data: {} }),
});

function UITranslationPage() {
	const initial = Route.useLoaderData();
	const [data, setData] = useState(initial);
	const [modalOpen, setModalOpen] = useState(false);
	const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
	const [filterLocale, setFilterLocale] = useState<string | undefined>();
	const [form] = Form.useForm();

	const refresh = useCallback(
		async (locale?: string) => {
			const result = await getList({ data: { locale, page: data.page } });
			setData(result);
		},
		[data.page],
	);

	async function handleSubmit(values: Record<string, unknown>) {
		try {
			const parsed = formSchema.parse({ ...values, id: editing?.id });
			await saveFn({ data: parsed });
			message.success(editing ? "翻译已更新" : "翻译已创建");
			setModalOpen(false);
			setEditing(null);
			form.resetFields();
			await refresh(filterLocale);
		} catch (err: unknown) {
			message.error(err instanceof Error ? err.message : "操作失败");
		}
	}

	function openCreate() {
		setEditing(null);
		form.resetFields();
		form.setFieldsValue({ locale: "en", valueType: "input" });
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
			await refresh(filterLocale);
		} catch (err: unknown) {
			message.error(err instanceof Error ? err.message : "删除失败");
		}
	}

	useEffect(() => {
		refresh(filterLocale);
	}, [filterLocale, refresh]);

	const columns = [
		{
			title: "语言",
			dataIndex: "locale",
			key: "locale",
			width: 80,
			render: (v: string) => <Tag>{v.toUpperCase()}</Tag>,
		},
		{ title: "Key", dataIndex: "key", key: "key", width: 200, ellipsis: true },
		{
			title: "翻译值",
			dataIndex: "value",
			key: "value",
			ellipsis: true,
			render: (v: string) => (
				<span className="text-sm">
					{v.slice(0, 100)}
					{v.length > 100 ? "…" : ""}
				</span>
			),
		},
		{
			title: "编辑器类型",
			dataIndex: "valueType",
			key: "valueType",
			width: 120,
			render: (v: string) => <Tag>{v}</Tag>,
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
			title="UI 翻译管理"
			extra={
				<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
					新增翻译
				</Button>
			}
		>
			<div className="mb-4">
				<Space>
					<Select
						placeholder="筛选语言"
						allowClear
						style={{ width: 120 }}
						value={filterLocale}
						onChange={(v) => setFilterLocale(v)}
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
						const r = await getList({ data: { locale: filterLocale, page } });
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
					<Form.Item name="locale" label="语言" rules={[{ required: true }]}>
						<Select
							options={SUPPORTED_LOCALES.map((l) => ({
								label: l.toUpperCase(),
								value: l,
							}))}
						/>
					</Form.Item>
					<Form.Item name="key" label="Key" rules={[{ required: true }]}>
						<Input placeholder="例如：home.heroTitle" />
					</Form.Item>
					<Form.Item name="value" label="翻译值" rules={[{ required: true }]}>
						<Input.TextArea rows={3} />
					</Form.Item>
					<Form.Item name="valueType" label="编辑器类型">
						<Select
							options={EDITOR_TYPES.map((t) => ({
								label: EDITOR_TYPE_LABELS[t],
								value: t,
							}))}
						/>
					</Form.Item>
				</Form>
			</Modal>
		</AdminPageContent>
	);
}
