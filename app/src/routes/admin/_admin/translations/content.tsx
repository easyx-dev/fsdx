/**
 * 实体翻译管理页：维护 content_translation 表
 */
import { DownloadOutlined, PlusOutlined } from "@ant-design/icons";
import { downloadFile } from "@fsdx/core/export";
import { SUPPORTED_LOCALES } from "@fsdx/core/i18n-types";
import { message } from "@fsdx/ui-spa/antd-static";
import { JsonImportButton } from "@fsdx/ui-spa/json-import-button";
import { ProTable, TableOperate } from "@fsdx/ui-spa/table";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Form, Input, Modal, Select, Space, Tag } from "antd";
import dayjs from "dayjs";
import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { AdminPageContent, EditorTypes } from "#/components/admin";
import { formSchema } from "#/services/i18n/content-translation.schemas";
import type { SortOrder } from "#/types/query";
import {
	deleteSFn,
	exportContentTranslationsSFn,
	getListSFn,
	importContentTranslationsSFn,
	saveSFn,
} from "./-mods/content-translations.functions";

export const Route = createFileRoute("/admin/_admin/translations/content")({
	component: ContentTranslationPage,
	loader: async () => await getListSFn({ data: {} }),
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
	const [sortField, setSortField] = useState<string | undefined>();
	const [sortOrder, setSortOrder] = useState<SortOrder | undefined>();
	const [form] = Form.useForm();

	// 搜索关键字输入防抖（300ms）
	useEffect(() => {
		const timer = setTimeout(() => setDebouncedKeyword(filterKeyword), 300);
		return () => clearTimeout(timer);
	}, [filterKeyword]);

	// 筛选条件变更时重置到第一页并刷新
	useEffect(() => {
		async function doRefresh() {
			const result = await getListSFn({
				data: {
					entityType: filterEntityType,
					locale: filterLocale,
					keyword: debouncedKeyword,
					page: 1,
					sortField,
					sortOrder,
				},
			});
			setData(result);
		}
		doRefresh();
	}, [filterEntityType, filterLocale, debouncedKeyword, sortField, sortOrder]);

	async function refresh() {
		const result = await getListSFn({
			data: {
				entityType: filterEntityType,
				locale: filterLocale,
				keyword: debouncedKeyword,
				page: data.page,
				sortField,
				sortOrder,
			},
		});
		setData(result);
	}

	/** 表格排序变更 */
	const handleTableChange = async (
		_pagination: unknown,
		_filters: unknown,
		sorter: unknown,
	) => {
		const s = sorter as { field?: string; order?: string };
		const field = s.field as string | undefined;
		const order = s.order as SortOrder | undefined;
		setSortField(field);
		setSortOrder(order);
		const result = await getListSFn({
			data: {
				entityType: filterEntityType,
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
			await deleteSFn({ data: { id } });
			message.success("翻译已删除");
			await refresh();
		} catch (err: unknown) {
			message.error(err instanceof Error ? err.message : "删除失败");
		}
	}

	/** 导出实体翻译数据（JSON） */
	async function handleExport() {
		try {
			const json = await exportContentTranslationsSFn();
			const timestamp = dayjs().format("YYYY-MM-DD");
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
			width: 120,
			sorter: true,
			render: (v: string) => <Tag color="blue">{v}</Tag>,
		},
		{
			title: "实体 ID",
			dataIndex: "entityId",
			key: "entityId",
			width: 120,
			ellipsis: true,
			copyable: true,
		},
		{
			title: "字段名",
			dataIndex: "fieldName",
			key: "fieldName",
			width: 100,
			sorter: true,
		},
		{
			title: "语言",
			dataIndex: "locale",
			key: "locale",
			width: 90,
			sorter: true,
			render: (v: string) => <Tag>{v.toUpperCase()}</Tag>,
		},
		{
			title: "翻译值",
			dataIndex: "value",
			key: "value",
			ellipsis: true,
			width: 450,
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
			render: (_: unknown, record: Record<string, unknown>) => (
				<TableOperate>
					<TableOperate.Edit onClick={() => openEdit(record)} />
					<TableOperate.Delete
						onConfirm={() => handleDelete(record.id as string)}
					/>
				</TableOperate>
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
							const result = await importContentTranslationsSFn({
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
						onChange={(e: ChangeEvent<HTMLInputElement>) =>
							setFilterKeyword(e.target.value)
						}
						onSearch={(v: string) => {
							setFilterKeyword(v);
							setDebouncedKeyword(v);
						}}
					/>
					<Select
						placeholder="实体类型"
						allowClear
						style={{ width: 120 }}
						value={filterEntityType}
						onChange={(v: string | undefined) => {
							setFilterEntityType(v);
						}}
						options={[{ label: "新闻", value: "news" }]}
					/>
					<Select
						placeholder="语言"
						allowClear
						style={{ width: 100 }}
						value={filterLocale}
						onChange={(v: string | undefined) => {
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
				onChange={handleTableChange}
				scroll={{ x: 1440 }}
				pagination={{
					total: data.total,
					pageSize: data.pageSize,
					current: data.page,
					onChange: async (page) => {
						const r = await getListSFn({
							data: {
								entityType: filterEntityType,
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
						<EditorTypes.Select />
					</Form.Item>
				</Form>
			</Modal>
		</AdminPageContent>
	);
}
