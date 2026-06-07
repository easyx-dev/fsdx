/**
 * 字典管理页面：字典类型 + 条目 CRUD（antd）
 */

import {
	CaretDownOutlined,
	CaretUpOutlined,
	DeleteOutlined,
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
	Form,
	Input,
	InputNumber,
	Modal,
	message,
	Popconfirm,
	Row,
	Select,
	Space,
	Switch,
	Table,
	Tag,
} from "antd";
import { useState } from "react";
import { z } from "zod";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import { TypeAwareEditor } from "#/components/admin/TypeAwareEditor";
import type { EditorType } from "#/lib/editor-types/editor-types";
import {
	EDITOR_TYPE_LABELS,
	EDITOR_TYPES,
} from "#/lib/editor-types/editor-types";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { permGuard } from "#/middleware/server-fn-auth";
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

const getDictList = createServerFn({ method: "GET" })
	.middleware([permGuard(PERMISSIONS.DICT_VIEW)])
	.handler(async () => {
		return getDictListService();
	});

const getDictItems = createServerFn({ method: "GET" })
	.middleware([permGuard(PERMISSIONS.DICT_VIEW)])
	.inputValidator(dictSlugSchema)
	.handler(async ({ data: { dictSlug } }) => {
		return getDictItemList(dictSlug);
	});

const createDictFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.DICT_CREATE)])
	.inputValidator(createDictSchema)
	.handler(async ({ data }) => {
		await createDict(data);
		return { success: true };
	});

const updateDictFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.DICT_EDIT)])
	.inputValidator(updateDictSchema)
	.handler(async ({ data }) => {
		const { id, ...rest } = data;
		await updateDict(id, rest);
		return { success: true };
	});

const deleteDictFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.DICT_DELETE)])
	.inputValidator(idSchema)
	.handler(async ({ data: { id } }) => {
		await deleteDict(id);
		return { success: true };
	});

const createDictItemFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.DICT_CREATE_ITEM)])
	.inputValidator(createItemSchema)
	.handler(async ({ data }) => {
		await createDictItem(data);
		return { success: true };
	});

const updateDictItemFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.DICT_EDIT_ITEM)])
	.inputValidator(updateItemSchema)
	.handler(async ({ data }) => {
		const { id, ...rest } = data;
		await updateDictItem(id, rest);
		return { success: true };
	});

const deleteDictItemFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.DICT_DELETE_ITEM)])
	.inputValidator(idSchema)
	.handler(async ({ data: { id } }) => {
		await deleteDictItem(id);
		return { success: true };
	});

export const Route = createFileRoute("/admin/_admin/dicts/")({
	component: DictsPage,
	loader: async () => await getDictList(),
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
		const data = await getDictItems({ data: { dictSlug } });
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
				await updateDictFn({
					data: {
						id: editingDict.id,
						slug: (values.slug as string) || undefined,
						name: values.name as string,
						description: (values.description as string) || undefined,
					},
				});
				message.success("字典更新成功");
			} else {
				await createDictFn({
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
				await updateDictItemFn({
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
				await createDictItemFn({
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
		await deleteDictFn({ data: { id } });
		message.success("字典已删除");
		if (selectedDict?.id === id) {
			setSelectedDictSlug(null);
			setItems([]);
		}
		router.invalidate();
	};

	const handleDeleteItem = async (id: string) => {
		await deleteDictItemFn({ data: { id } });
		message.success("条目已删除");
		if (selectedDictSlug) refreshItems(selectedDictSlug);
	};

	/** 表格内直接修改排序或状态 */
	const handleInlineUpdate = async (
		id: string,
		params: { sortOrder?: number; status?: string },
	) => {
		try {
			await updateDictItemFn({ data: { id, ...params } });
			if (selectedDictSlug) refreshItems(selectedDictSlug);
		} catch (err) {
			message.error(err instanceof Error ? err.message : "操作失败");
		}
	};

	/** 字典类型表格列定义 */
	const dictColumns = [
		{
			title: "字典名称",
			dataIndex: "name",
			key: "name",
			render: (_: string, record: DictRecord) => {
				const isActive = selectedDictSlug === record.slug;
				return (
					<div className="flex items-center gap-2">
						{isActive && (
							<span className="w-1 h-6 rounded-full bg-blue-500 flex-shrink-0" />
						)}
						<div>
							<div
								className={
									isActive
										? "font-semibold text-blue-600 dark:text-blue-400"
										: ""
								}
							>
								{record.name}
							</div>
							<div className="text-xs text-muted-foreground">{record.slug}</div>
						</div>
					</div>
				);
			},
		},
		{
			title: "操作",
			key: "actions",
			width: 100,
			render: (_: unknown, record: DictRecord) => (
				<Space size={4}>
					<Button
						type="link"
						size="small"
						icon={<EditOutlined />}
						onClick={() => openDictModal(record)}
					/>
					<Popconfirm
						title="确定删除该字典及所有条目？"
						onConfirm={() => handleDeleteDict(record.id)}
					>
						<Button type="link" size="small" danger icon={<DeleteOutlined />} />
					</Popconfirm>
				</Space>
			),
		},
	];

	/** 字典条目表格列定义 */
	const itemColumns = [
		{ title: "标签", dataIndex: "label", key: "label" },
		{
			title: "值",
			dataIndex: "value",
			key: "value",
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
			render: (val: string | null) =>
				val ? (EDITOR_TYPE_LABELS[val as EditorType] ?? val) : "—",
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
			title: "操作",
			key: "actions",
			width: 100,
			render: (_: unknown, record: DictItemRecord) => (
				<Space size={4}>
					<Button
						type="link"
						size="small"
						icon={<EditOutlined />}
						onClick={() => openItemModal(record)}
					/>
					<Popconfirm
						title="确定删除该条目？"
						onConfirm={() => handleDeleteItem(record.id)}
					>
						<Button type="link" size="small" danger icon={<DeleteOutlined />} />
					</Popconfirm>
				</Space>
			),
		},
	];

	const selectedDict = dictList.find((d) => d.slug === selectedDictSlug);

	return (
		<AdminPageContent title="字典管理">
			<Row gutter={20}>
				<Col span={8}>
					<Card
						size="small"
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
						<Table
							dataSource={dictList}
							columns={dictColumns}
							rowKey="id"
							size="small"
							showHeader={false}
							pagination={false}
							locale={{ emptyText: "暂无字典" }}
							onRow={(record) => ({
								onClick: () => handleSelectDict(record.slug),
								style: { cursor: "pointer" },
							})}
							rowClassName={(record) =>
								selectedDictSlug === record.slug
									? "bg-blue-50/80 dark:bg-blue-950/40"
									: ""
							}
						/>
					</Card>
				</Col>
				<Col span={16}>
					<Card
						size="small"
						title={
							selectedDictSlug ? (
								<span className="text-sm">
									<span className="font-medium">
										{selectedDict?.name ?? "—"}
									</span>
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
							<Table
								dataSource={items}
								columns={itemColumns}
								rowKey="id"
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
				</Col>
			</Row>

			{/* 字典创建/编辑弹窗 */}
			<Modal
				title={editingDict ? "编辑字典" : "新建字典"}
				open={dictModalOpen}
				onCancel={closeDictModal}
				footer={null}
				destroyOnClose
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
						<Input placeholder="唯一标识" />
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
				destroyOnClose
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
						<Input placeholder="存储值" />
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
								<Select
									allowClear
									placeholder="选择编辑器类型"
									options={EDITOR_TYPES.map((t) => ({
										label: EDITOR_TYPE_LABELS[t],
										value: t,
									}))}
								/>
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
