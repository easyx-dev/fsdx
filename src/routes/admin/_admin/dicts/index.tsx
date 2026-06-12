/**
 * 字典管理页面：字典类型 + 条目 CRUD（antd）
 */

import {
	CaretDownOutlined,
	CaretUpOutlined,
	DeleteOutlined,
	DownloadOutlined,
	EditOutlined,
	PlusOutlined,
} from "@ant-design/icons";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
	Button,
	Card,
	Col,
	ColorPicker,
	Divider,
	Flex,
	Form,
	Input,
	InputNumber,
	Modal,
	message,
	Popconfirm,
	Row,
	Space,
	Switch,
	Tag,
} from "antd";
import dayjs from "dayjs";
import { useState } from "react";
import { z } from "zod";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import { EditorTypePreview } from "#/components/admin/EditorTypePreview";
import { EditorTypeSelect } from "#/components/admin/EditorTypeSelect";
import { FieldTranslationDrawer } from "#/components/admin/FieldTranslationDrawer";
import { JsonImportButton } from "#/components/admin/JsonImportButton";
import { ProTable } from "#/components/admin/ProTable";
import { TypeAwareEditor } from "#/components/admin/TypeAwareEditor";
import { PRESET_DICTS } from "#/lib/constants/admin-constants";
import type { EditorType } from "#/lib/editor-types/editor-types";
import { downloadFile } from "#/lib/export/export.utils";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import { exportDictsSFn, importDictsSFn } from "#/server/dict/dict.functions";
import type { DictItemRecord, DictRecord } from "#/server/dict/dict.server";
import {
	createDict,
	createDictItem,
	deleteDict,
	deleteDictItem,
	getDictItemList,
	getDictList as getDictListService,
	updateDict,
	updateDictItem,
} from "#/server/dict/dict.server";
import { logOperation } from "#/server/operation-log/operation-log.server";

/** 字典条目可翻译字段定义 */
const DICT_ITEM_TRANSLATABLE_FIELDS = [
	{ name: "label", label: "标签", valueType: "input" as const },
];
const dictSlugSchema = z.object({ dictSlug: z.string().min(1) });
const idSchema = z.object({ id: z.string().min(1) });
const createDictSchema = z.object({
	name: z.string().min(1).max(100),
	slug: z.string().min(1).max(50),
	description: z.string().optional(),
});
const updateDictSchema = z.object({
	id: z.string().min(1),
	slug: z.string().min(1).max(50).optional(),
	name: z.string().min(1).max(100).optional(),
	description: z.string().optional(),
});
const createItemSchema = z.object({
	dictSlug: z.string().min(1),
	label: z.string().min(1).max(100),
	value: z.string().min(1).max(100),
	sortOrder: z.number().default(0),
	extraType: z.string().optional(),
	extra: z.string().optional(),
	color: z.string().optional(),
});
const updateItemSchema = z.object({
	id: z.string().min(1),
	label: z.string().max(100).optional(),
	value: z.string().max(100).optional(),
	sortOrder: z.number().optional(),
	status: z.string().optional(),
	extraType: z.string().optional(),
	extra: z.string().optional(),
	color: z.string().optional(),
});

const getDictListSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.DICT_VIEW)])
	.handler(async () => {
		return getDictListService();
	});

const getDictItemsSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.DICT_VIEW)])
	.inputValidator(dictSlugSchema)
	.handler(async ({ data: { dictSlug } }) => {
		return getDictItemList(dictSlug);
	});

const createDictSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.DICT_CREATE)])
	.inputValidator(createDictSchema)
	.handler(async ({ data, context }) => {
		const result = await createDict(data);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "dict",
			action: "create",
			targetType: "dict",
			targetId: result.id,
			targetName: result.name,
		});
		return { success: true };
	});

const updateDictSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.DICT_EDIT)])
	.inputValidator(updateDictSchema)
	.handler(async ({ data, context }) => {
		const { id, ...rest } = data;
		await updateDict(id, rest);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "dict",
			action: "update",
			targetType: "dict",
			targetId: data.id,
		});
		return { success: true };
	});

const deleteDictSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.DICT_DELETE)])
	.inputValidator(idSchema)
	.handler(async ({ data: { id }, context }) => {
		await deleteDict(id);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "dict",
			action: "delete",
			targetType: "dict",
			targetId: id,
		});
		return { success: true };
	});

const createDictItemSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.DICT_CREATE_ITEM)])
	.inputValidator(createItemSchema)
	.handler(async ({ data, context }) => {
		const result = await createDictItem(data);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "dict",
			action: "create",
			targetType: "dict_item",
			targetId: result.id,
			targetName: `${data.dictSlug}:${data.label}`,
		});
		return { success: true };
	});

const updateDictItemSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.DICT_EDIT_ITEM)])
	.inputValidator(updateItemSchema)
	.handler(async ({ data, context }) => {
		const { id, ...rest } = data;
		await updateDictItem(id, rest);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "dict",
			action: "update",
			targetType: "dict_item",
			targetId: data.id,
		});
		return { success: true };
	});

const deleteDictItemSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.DICT_DELETE_ITEM)])
	.inputValidator(idSchema)
	.handler(async ({ data: { id }, context }) => {
		await deleteDictItem(id);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "dict",
			action: "delete",
			targetType: "dict_item",
			targetId: id,
		});
		return { success: true };
	});

export const Route = createFileRoute("/admin/_admin/dicts/")({
	component: DictsPage,
	loader: async () => await getDictListSFn(),
});

/** 字典管理页面组件 */
function DictsPage() {
	const router = useRouter();
	const dictList = Route.useLoaderData();
	const [selectedDictSlug, setSelectedDictSlug] = useState<string | null>(null);
	const [items, setItems] = useState<DictItemRecord[]>([]);
	const [dictModalOpen, setDictModalOpen] = useState(false);
	const [editingDict, setEditingDict] = useState<DictRecord | null>(null);
	const [itemModalOpen, setItemModalOpen] = useState(false);
	const [editingItem, setEditingItem] = useState<DictItemRecord | null>(null);
	const [advancedExpanded, setAdvancedExpanded] = useState(false);
	const [dictForm] = Form.useForm();
	const [itemForm] = Form.useForm();
	const watchedExtraType = Form.useWatch("extraType", itemForm) as
		| EditorType
		| undefined;

	const refreshItems = async (dictSlug: string) => {
		const data = await getDictItemsSFn({ data: { dictSlug } });
		setItems(data);
	};

	const handleSelectDict = (dictSlug: string) => {
		setSelectedDictSlug(dictSlug);
		refreshItems(dictSlug);
	};

	/** 打开字典创建/编辑弹窗 */
	const openDictModal = (dict?: DictRecord) => {
		if (dict) {
			setEditingDict(dict);
			dictForm.setFieldsValue({
				name: dict.name,
				slug: dict.slug,
				description: dict.description,
			});
		} else {
			setEditingDict(null);
			dictForm.resetFields();
		}
		setDictModalOpen(true);
	};

	const closeDictModal = () => {
		setDictModalOpen(false);
		setEditingDict(null);
		dictForm.resetFields();
	};

	const handleDictSubmit = async (values: Record<string, unknown>) => {
		try {
			if (editingDict) {
				await updateDictSFn({
					data: {
						id: editingDict.id,
						slug: (values.slug as string) || undefined,
						name: values.name as string,
						description: (values.description as string) || undefined,
					},
				});
				message.success("字典更新成功");
			} else {
				await createDictSFn({
					data: {
						name: values.name as string,
						slug: values.slug as string,
						description: (values.description as string) || undefined,
					},
				});
				message.success("字典创建成功");
			}
			closeDictModal();
			router.invalidate();
		} catch (err) {
			message.error(err instanceof Error ? err.message : "操作失败");
		}
	};

	/** 打开条目创建/编辑弹窗 */
	const openItemModal = (item?: DictItemRecord) => {
		if (item) {
			setEditingItem(item);
			itemForm.setFieldsValue({
				label: item.label,
				value: item.value,
				sortOrder: item.sortOrder,
				extraType: item.extraType ?? undefined,
				extra: item.extra ?? undefined,
				color: item.color ?? undefined,
			});
			// 编辑时如果已存在高级配置则自动展开
			setAdvancedExpanded(!!(item.extraType || item.extra || item.color));
		} else {
			setEditingItem(null);
			itemForm.resetFields();
			itemForm.setFieldsValue({ sortOrder: 0 });
			setAdvancedExpanded(false);
		}
		setItemModalOpen(true);
	};

	const closeItemModal = () => {
		setItemModalOpen(false);
		setEditingItem(null);
		setAdvancedExpanded(false);
		itemForm.resetFields();
	};

	const handleItemSubmit = async (values: Record<string, unknown>) => {
		if (!selectedDictSlug) return;
		try {
			if (editingItem) {
				await updateDictItemSFn({
					data: {
						id: editingItem.id,
						label: values.label as string,
						value: values.value as string,
						sortOrder: (values.sortOrder as number) ?? 0,
						extraType: (values.extraType as string) || undefined,
						extra: (values.extra as string) || undefined,
						color: (values.color as string) || undefined,
					},
				});
				message.success("条目更新成功");
			} else {
				await createDictItemSFn({
					data: {
						dictSlug: selectedDictSlug,
						label: values.label as string,
						value: values.value as string,
						sortOrder: (values.sortOrder as number) ?? 0,
						extraType: (values.extraType as string) || undefined,
						extra: (values.extra as string) || undefined,
						color: (values.color as string) || undefined,
					},
				});
				message.success("条目创建成功");
			}
			closeItemModal();
			refreshItems(selectedDictSlug);
		} catch (err) {
			message.error(err instanceof Error ? err.message : "操作失败");
		}
	};

	const handleDeleteDict = async (id: string) => {
		await deleteDictSFn({ data: { id } });
		message.success("字典已删除");
		if (selectedDict?.id === id) {
			setSelectedDictSlug(null);
			setItems([]);
		}
		router.invalidate();
	};

	const handleDeleteItem = async (id: string) => {
		await deleteDictItemSFn({ data: { id } });
		message.success("条目已删除");
		if (selectedDictSlug) refreshItems(selectedDictSlug);
	};

	/** 表格内直接修改排序或状态 */
	const handleInlineUpdate = async (
		id: string,
		params: { sortOrder?: number; status?: string },
	) => {
		try {
			await updateDictItemSFn({ data: { id, ...params } });
			if (selectedDictSlug) refreshItems(selectedDictSlug);
		} catch (err) {
			message.error(err instanceof Error ? err.message : "操作失败");
		}
	};

	/** 导出字典数据（JSON） */
	const handleExportDicts = async () => {
		const json = await exportDictsSFn();
		const timestamp = dayjs().format("YYYY-MM-DD");
		downloadFile(json, `dicts_export_${timestamp}.json`, "application/json");
		message.success("导出完成");
	};
	/** 字典条目表格列定义 */
	const itemColumns = [
		{ title: "标签", dataIndex: "label", key: "label", width: 120 },
		{
			title: "值",
			dataIndex: "value",
			key: "value",
			width: 180,
			render: (val: string) => <code className="text-xs">{val}</code>,
		},
		{
			title: "排序",
			dataIndex: "sortOrder",
			key: "sortOrder",
			width: 120,
			render: (val: number, record: DictItemRecord) => (
				<InputNumber
					size="small"
					className="w-full"
					min={0}
					value={val}
					onChange={(v) => {
						if (v != null && v !== val) {
							handleInlineUpdate(record.id, { sortOrder: v });
						}
					}}
				/>
			),
		},
		{
			title: "状态",
			dataIndex: "status",
			key: "status",
			width: 80,
			render: (val: string, record: DictItemRecord) => (
				<Switch
					size="small"
					checked={val === "active"}
					checkedChildren="启用"
					unCheckedChildren="禁用"
					onChange={(checked) => {
						handleInlineUpdate(record.id, {
							status: checked ? "active" : "disabled",
						});
					}}
				/>
			),
		},
		{
			title: "额外类型",
			dataIndex: "extraType",
			key: "extraType",
			width: 110,
			render: (val: string | null) => <EditorTypePreview valueType={val} />,
		},
		{
			title: "额外值",
			dataIndex: "extra",
			key: "extra",
			width: 120,
			ellipsis: true,
			render: (val: string | null) => val || "—",
		},
		{
			title: "颜色",
			dataIndex: "color",
			key: "color",
			width: 80,
			render: (val: string | null) =>
				val ? <Tag color={val}>{val}</Tag> : "—",
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
		},
		{
			title: "操作",
			key: "actions",
			fixed: "right" as const,
			render: (_: unknown, record: DictItemRecord) => (
				<Space size={4}>
					<Button
						type="link"
						size="small"
						icon={<EditOutlined />}
						onClick={() => openItemModal(record)}
					/>
					<FieldTranslationDrawer
						entityType="dict_item"
						entityId={record.id}
						fields={DICT_ITEM_TRANSLATABLE_FIELDS}
						originalValues={{ label: record.label ?? "" }}
					/>
					{!isPresetDict(record.dictSlug) && (
						<Popconfirm
							title="确定删除该条目？"
							onConfirm={() => handleDeleteItem(record.id)}
						>
							<Button
								type="link"
								size="small"
								danger
								icon={<DeleteOutlined />}
							/>
						</Popconfirm>
					)}
				</Space>
			),
		},
	];

	const selectedDict = dictList.find((d) => d.slug === selectedDictSlug);

	const isPresetDict = (slug: string) =>
		PRESET_DICTS.some((d) => d.slug === slug);

	return (
		<AdminPageContent
			title="字典管理"
			extra={
				<Space>
					<Button icon={<DownloadOutlined />} onClick={handleExportDicts}>
						导出 JSON
					</Button>

					<JsonImportButton
						onImport={async (jsonString) => {
							const data = JSON.parse(jsonString);
							const result = await importDictsSFn({ data: { data } });
							message.success(
								`导入完成：字典类型 新增 ${result.dictsCreated} / 更新 ${result.dictsUpdated}，` +
									`条目 新增 ${result.itemsCreated} / 更新 ${result.itemsUpdated}` +
									(result.itemsSkipped > 0
										? ` / 跳过 ${result.itemsSkipped}`
										: ""),
							);
							router.invalidate();
							if (selectedDictSlug) refreshItems(selectedDictSlug);
						}}
					>
						导入 JSON
					</JsonImportButton>
				</Space>
			}
		>
			<Flex gap={20}>
				<Card
					size="small"
					classNames={{
						root: "flex-[0_0_200px]",
					}}
					title="字典类型"
					extra={
						<Button
							type="primary"
							size="small"
							icon={<PlusOutlined />}
							onClick={() => openDictModal()}
						>
							新建字典
						</Button>
					}
					styles={{ body: { padding: 0 } }}
				>
					{dictList.length === 0 ? (
						<div className="p-4 text-center text-muted-foreground text-sm">
							暂无字典
						</div>
					) : (
						<div className="divide-y divide-border">
							{dictList.map((record) => {
								const isActive = selectedDictSlug === record.slug;
								return (
									<div
										key={record.id}
										className={`flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
											isActive ? "bg-blue-50/80 dark:bg-blue-950/40" : ""
										}`}
										onClick={() => handleSelectDict(record.slug)}
									>
										<div className="flex items-center gap-2 min-w-0">
											{isActive && (
												<span className="w-1 h-6 rounded-full bg-blue-500 flex-shrink-0" />
											)}
											<div className="min-w-0">
												<div
													className={
														isActive
															? "font-semibold text-blue-600 dark:text-blue-400 truncate"
															: "truncate"
													}
												>
													{record.name}
												</div>
												<div className="text-xs text-muted-foreground truncate">
													{record.slug}
												</div>
											</div>
										</div>
										<Space size={4} className="flex-shrink-0 ml-2">
											<Button
												type="link"
												size="small"
												icon={<EditOutlined />}
												onClick={(e) => {
													e.stopPropagation();
													openDictModal(record);
												}}
											/>
											{!isPresetDict(record.slug) && (
												<Popconfirm
													title="确定删除该字典及所有条目？"
													onConfirm={(e) => {
														e?.stopPropagation();
														handleDeleteDict(record.id);
													}}
													onCancel={(e) => e?.stopPropagation()}
												>
													<Button
														type="link"
														size="small"
														danger
														icon={<DeleteOutlined />}
														onClick={(e) => e.stopPropagation()}
													/>
												</Popconfirm>
											)}
										</Space>
									</div>
								);
							})}
						</div>
					)}
				</Card>
				<Card
					size="small"
					classNames={{
						root: "flex-1 min-w-0",
					}}
					title={
						selectedDictSlug ? (
							<span className="text-sm">
								<span className="font-medium">{selectedDict?.name ?? "—"}</span>
								<span className="text-muted-foreground ml-2">
									· 条目 ({items.length})
								</span>
							</span>
						) : (
							"字典条目"
						)
					}
					extra={
						selectedDictSlug ? (
							<Button
								type="primary"
								size="small"
								icon={<PlusOutlined />}
								onClick={() => openItemModal()}
							>
								新建条目
							</Button>
						) : undefined
					}
					styles={{ body: { padding: 0 } }}
				>
					{selectedDictSlug ? (
						<ProTable
							dataSource={items}
							columns={itemColumns}
							rowKey="id"
							scroll={{ x: 1300 }}
							size="small"
							pagination={false}
							locale={{ emptyText: "暂无条目" }}
						/>
					) : (
						<div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
							请选择左侧字典查看条目
						</div>
					)}
				</Card>
			</Flex>

			{/* 字典创建/编辑弹窗 */}
			<Modal
				title={editingDict ? "编辑字典" : "新建字典"}
				open={dictModalOpen}
				onCancel={closeDictModal}
				footer={null}
				destroyOnHidden
			>
				<Form form={dictForm} layout="vertical" onFinish={handleDictSubmit}>
					<Form.Item
						name="name"
						label="名称"
						rules={[{ required: true, message: "请输入字典名称" }]}
					>
						<Input placeholder="字典名称" />
					</Form.Item>
					<Form.Item
						name="slug"
						label="标识 (slug)"
						rules={[{ required: true, message: "请输入字典标识" }]}
					>
						<Input
							placeholder="唯一标识"
							disabled={!!editingDict && isPresetDict(editingDict.slug)}
						/>
					</Form.Item>
					<Form.Item name="description" label="描述">
						<Input.TextArea rows={2} placeholder="字典描述（可选）" />
					</Form.Item>
					<Form.Item className="mb-0 text-right">
						<Space>
							<Button onClick={closeDictModal}>取消</Button>
							<Button type="primary" htmlType="submit">
								{editingDict ? "保存" : "创建"}
							</Button>
						</Space>
					</Form.Item>
				</Form>
			</Modal>

			{/* 条目创建/编辑弹窗 */}
			<Modal
				title={editingItem ? "编辑条目" : "新建条目"}
				open={itemModalOpen}
				onCancel={closeItemModal}
				footer={null}
				width={advancedExpanded ? 720 : 520}
				destroyOnHidden
			>
				<Form
					form={itemForm}
					layout="vertical"
					onFinish={handleItemSubmit}
					initialValues={{ sortOrder: 0 }}
				>
					<Form.Item
						name="label"
						label="标签"
						rules={[{ required: true, message: "请输入标签" }]}
					>
						<Input placeholder="显示名称" />
					</Form.Item>
					<Form.Item
						name="value"
						label="值"
						rules={[{ required: true, message: "请输入值" }]}
					>
						<Input
							placeholder="存储值"
							disabled={!!editingItem && isPresetDict(editingItem.dictSlug)}
						/>
					</Form.Item>
					<Divider plain style={{ margin: "8px 0 12px" }}>
						<Button
							type="link"
							size="small"
							className="px-0 text-xs"
							icon={
								advancedExpanded ? <CaretUpOutlined /> : <CaretDownOutlined />
							}
							onClick={() => setAdvancedExpanded(!advancedExpanded)}
						>
							高级配置
						</Button>
					</Divider>
					{advancedExpanded && (
						<>
							<Row gutter={16}>
								<Col span={12}>
									<Form.Item name="sortOrder" label="排序">
										<InputNumber
											className="w-full"
											min={0}
											placeholder="排序序号"
										/>
									</Form.Item>
								</Col>
								<Col span={12}>
									<Form.Item
										name="color"
										label="颜色"
										getValueFromEvent={(
											color: { toHexString?: () => string } | string,
										) =>
											typeof color === "string"
												? color
												: (color?.toHexString?.() ?? undefined)
										}
									>
										<ColorPicker allowClear format="hex" />
									</Form.Item>
								</Col>
							</Row>
							<Form.Item name="extraType" label="额外类型">
								<EditorTypeSelect allowClear />
							</Form.Item>
							{watchedExtraType ? (
								<Form.Item name="extra" label="额外值">
									<TypeAwareEditor
										type={watchedExtraType}
										placeholder="额外扩展值"
									/>
								</Form.Item>
							) : (
								<Form.Item name="extra" label="额外值">
									<Input.TextArea
										rows={3}
										placeholder="额外扩展值（选择额外类型后可切换编辑器）"
									/>
								</Form.Item>
							)}
						</>
					)}
					<Form.Item className="mb-0 text-right">
						<Space>
							<Button onClick={closeItemModal}>取消</Button>
							<Button type="primary" htmlType="submit">
								{editingItem ? "保存" : "创建"}
							</Button>
						</Space>
					</Form.Item>
				</Form>
			</Modal>
		</AdminPageContent>
	);
}
