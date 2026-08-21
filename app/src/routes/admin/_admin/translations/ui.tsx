/**
 * UI 翻译管理页：维护 ui_translation 表
 */
import { DownloadOutlined, PlusOutlined } from "@ant-design/icons";
import { downloadFile } from "@fsdx/core/export";
import { type Locale, SUPPORTED_LOCALES } from "@fsdx/core/i18n-types";
import { message } from "@fsdx/ui-spa/antd-static";
import { JsonImportButton } from "@fsdx/ui-spa/json-import-button";
import { ProTable, TableOperate } from "@fsdx/ui-spa/table";
import { createFileRoute } from "@tanstack/react-router";
import type { TableProps } from "antd";
import { Button, Form, Input, Modal, Select, Space, Tag } from "antd";
import dayjs from "dayjs";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { AdminPageContent, EditorTypes } from "#/components/admin";
import type { uiTranslation } from "#/db/schema";
import { formSchema } from "#/services/i18n/ui-translation.schemas";
import type { SortOrder } from "#/types/query";
import {
	deleteSFn,
	exportUITranslationsSFn,
	getListSFn,
	importUITranslationsSFn,
	saveSFn,
} from "./-mods/ui-translations.functions";

/** UI 翻译行记录类型 */
type UiTranslationRow = typeof uiTranslation.$inferSelect;

export const Route = createFileRoute("/admin/_admin/translations/ui")({
	component: UITranslationPage,
	loader: async () => await getListSFn({ data: {} }),
});

function UITranslationPage() {
	const initial = Route.useLoaderData();
	const [data, setData] = useState(initial);
	const [modalOpen, setModalOpen] = useState(false);
	const [editing, setEditing] = useState<UiTranslationRow | null>(null);
	const [filterLocale, setFilterLocale] = useState<Locale>();
	const [filterKeyword, setFilterKeyword] = useState<string>("");
	// 防抖后的搜索关键字，用于触发 API 请求
	const [debouncedKeyword, setDebouncedKeyword] = useState<string>("");
	const [sortField, setSortField] = useState<string>();
	const [sortOrder, setSortOrder] = useState<SortOrder>();
	const [form] = Form.useForm();

	// 搜索关键字输入防抖（300ms）
	useEffect(() => {
		const timer = setTimeout(() => setDebouncedKeyword(filterKeyword), 300);
		return () => clearTimeout(timer);
	}, [filterKeyword]);

	const refresh = useCallback(
		async (locale?: Locale, keyword?: string) => {
			const result = await getListSFn({
				data: { locale, keyword, page: data.page, sortField, sortOrder },
			});
			setData(result);
		},
		[data.page, sortField, sortOrder],
	);

	/** 表格排序变更 */
	const handleTableChange: TableProps<UiTranslationRow>["onChange"] = async (
		_pagination,
		_filters,
		sorter,
	) => {
		const s = Array.isArray(sorter) ? sorter[0] : sorter;
		const field = typeof s?.field === "string" ? s.field : undefined;
		const order =
			s?.order === "ascend" || s?.order === "descend" ? s.order : undefined;
		setSortField(field);
		setSortOrder(order);
		const result = await getListSFn({
			data: {
				locale: filterLocale,
				keyword: debouncedKeyword,
				sortField: field,
				sortOrder: order,
			},
		});
		setData(result);
	};

	async function handleSubmit(values: Record<string, unknown>) {
		try {
			const parsed = formSchema.parse({ ...values, id: editing?.id });
			await saveSFn({ data: parsed });
			message.success(editing ? "翻译已更新" : "翻译已创建");
			setModalOpen(false);
			setEditing(null);
			form.resetFields();
			await refresh(filterLocale, debouncedKeyword);
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

	function openEdit(record: UiTranslationRow) {
		setEditing(record);
		form.setFieldsValue(record);
		setModalOpen(true);
	}

	async function handleDelete(id: string) {
		try {
			await deleteSFn({ data: { id } });
			message.success("翻译已删除");
			await refresh(filterLocale, debouncedKeyword);
		} catch (err: unknown) {
			message.error(err instanceof Error ? err.message : "删除失败");
		}
	}

	/** 导出 UI 翻译数据（JSON） */
	async function handleExport() {
		try {
			const json = await exportUITranslationsSFn();
			const timestamp = dayjs().format("YYYY-MM-DD");
			downloadFile(
				json,
				`ui_translations_export_${timestamp}.json`,
				"application/json",
			);
			message.success("导出完成");
		} catch (err: unknown) {
			message.error(err instanceof Error ? err.message : "导出失败");
		}
	}
	useEffect(() => {
		refresh(filterLocale, debouncedKeyword);
	}, [filterLocale, debouncedKeyword, refresh]);

	const columns = [
		{
			title: "语言",
			dataIndex: "locale",
			key: "locale",
			width: 80,
			sorter: true,
			render: (v: string) => <Tag>{v.toUpperCase()}</Tag>,
		},
		{
			title: "Key",
			dataIndex: "key",
			key: "key",
			width: 200,
			ellipsis: true,
			sorter: true,
		},
		{
			title: "翻译值",
			dataIndex: "value",
			key: "value",
			ellipsis: true,
			width: 450,
		},
		{
			title: "编辑器类型",
			dataIndex: "valueType",
			key: "valueType",
			width: 120,
			render: (v: string) => <EditorTypes.Preview valueType={v} />,
		},
		{
			title: "创建时间",
			dataIndex: "createdAt",
			key: "createdAt",
			width: 185,
			valueType: "dateTime",
		},
		{
			title: "更新时间",
			dataIndex: "updatedAt",
			key: "updatedAt",
			width: 185,
			valueType: "dateTime",
			sorter: true,
		},
		{
			title: "操作",
			key: "actions",
			fixed: "right" as const,
			render: (_: unknown, record: UiTranslationRow) => (
				<TableOperate>
					<TableOperate.Edit onClick={() => openEdit(record)} />
					<TableOperate.Delete onConfirm={() => handleDelete(record.id)} />
				</TableOperate>
			),
		},
	];

	return (
		<AdminPageContent
			title="UI 翻译管理"
			extra={
				<Space>
					<Button icon={<DownloadOutlined />} onClick={handleExport}>
						导出 JSON
					</Button>

					<JsonImportButton
						onImport={async (jsonString) => {
							const data = JSON.parse(jsonString);
							const result = await importUITranslationsSFn({ data: { data } });
							message.success(
								`导入完成：新增 ${result.created} / 更新 ${result.updated}`,
							);
							await refresh(filterLocale, debouncedKeyword);
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
						placeholder="搜索 Key 或翻译值"
						allowClear
						style={{ width: 260 }}
						value={filterKeyword}
						onChange={(e: ChangeEvent<HTMLInputElement>) =>
							setFilterKeyword(e.target.value)
						}
						onSearch={(v: string) => {
							setFilterKeyword(v);
							setDebouncedKeyword(v);
						}}
					/>
					<Select
						placeholder="筛选语言"
						allowClear
						style={{ width: 120 }}
						value={filterLocale}
						onChange={(v?: Locale) => setFilterLocale(v)}
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
				onChange={handleTableChange}
				scroll={{ x: 1400 }}
				pagination={{
					total: data.total,
					pageSize: data.pageSize,
					current: data.page,
					onChange: async (page) => {
						const r = await getListSFn({
							data: {
								locale: filterLocale,
								keyword: debouncedKeyword,
								page,
								sortField,
								sortOrder,
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
						<EditorTypes.Select />
					</Form.Item>
				</Form>
			</Modal>
		</AdminPageContent>
	);
}
