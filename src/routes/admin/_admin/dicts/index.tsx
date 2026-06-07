/**
 * 字典管理页面：字典类型 + 条目 CRUD（antd）
 */

import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
	Button,
	Col,
	Form,
	Input,
	InputNumber,
	Modal,
	message,
	Popconfirm,
	Row,
	Space,
	Table,
	Tag,
} from "antd";
import { useState } from "react";
import { z } from "zod";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
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

const dictIdSchema = z.object({ dictId: z.string().min(1) });
const idSchema = z.object({ id: z.string().min(1) });
const createDictSchema = z.object({
	name: z.string().min(1).max(100),
	slug: z.string().min(1).max(50),
	description: z.string().optional(),
});
const updateDictSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1).max(100).optional(),
	description: z.string().optional(),
});
const createItemSchema = z.object({
	dictId: z.string().min(1),
	label: z.string().min(1).max(100),
	value: z.string().min(1).max(100),
	sortOrder: z.number().default(0),
});
const updateItemSchema = z.object({
	id: z.string().min(1),
	label: z.string().max(100).optional(),
	value: z.string().max(100).optional(),
	sortOrder: z.number().optional(),
	status: z.string().optional(),
});

const getDictList = createServerFn({ method: "GET" })
	.middleware([permGuard(PERMISSIONS.DICT_VIEW)])
	.handler(async () => {
		return getDictListService();
	});

const getDictItems = createServerFn({ method: "GET" })
	.middleware([permGuard(PERMISSIONS.DICT_VIEW)])
	.inputValidator(dictIdSchema)
	.handler(async ({ data: { dictId } }) => {
		return getDictItemList(dictId);
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
	const [selectedDictId, setSelectedDictId] = useState<string | null>(null);
	const [items, setItems] = useState<DictItemRecord[]>([]);
	const [dictModalOpen, setDictModalOpen] = useState(false);
	const [editingDict, setEditingDict] = useState<DictRecord | null>(null);
	const [itemModalOpen, setItemModalOpen] = useState(false);
	const [editingItem, setEditingItem] = useState<DictItemRecord | null>(null);
	const [dictForm] = Form.useForm();
	const [itemForm] = Form.useForm();

	const refreshItems = async (dictId: string) => {
		const data = await getDictItems({ data: { dictId } });
		setItems(data);
	};

	const handleSelectDict = (dictId: string) => {
		setSelectedDictId(dictId);
		refreshItems(dictId);
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
			});
		} else {
			setEditingItem(null);
			itemForm.resetFields();
			itemForm.setFieldsValue({ sortOrder: 0 });
		}
		setItemModalOpen(true);
	};

	const closeItemModal = () => {
		setItemModalOpen(false);
		setEditingItem(null);
		itemForm.resetFields();
	};

	const handleItemSubmit = async (values: Record<string, unknown>) => {
		if (!selectedDictId) return;
		try {
			if (editingItem) {
				await updateDictItemFn({
					data: {
						id: editingItem.id,
						label: values.label as string,
						value: values.value as string,
						sortOrder: (values.sortOrder as number) ?? 0,
					},
				});
				message.success("条目更新成功");
			} else {
				await createDictItemFn({
					data: {
						dictId: selectedDictId,
						label: values.label as string,
						value: values.value as string,
						sortOrder: (values.sortOrder as number) ?? 0,
					},
				});
				message.success("条目创建成功");
			}
			closeItemModal();
			refreshItems(selectedDictId);
		} catch (err) {
			message.error(err instanceof Error ? err.message : "操作失败");
		}
	};

	const handleDeleteDict = async (id: string) => {
		await deleteDictFn({ data: { id } });
		message.success("字典已删除");
		if (selectedDictId === id) {
			setSelectedDictId(null);
			setItems([]);
		}
		router.invalidate();
	};

	const handleDeleteItem = async (id: string) => {
		await deleteDictItemFn({ data: { id } });
		message.success("条目已删除");
		if (selectedDictId) refreshItems(selectedDictId);
	};

	/** 字典类型表格列定义 */
	const dictColumns = [
		{
			title: "字典名称",
			dataIndex: "name",
			key: "name",
			render: (_: string, record: DictRecord) => (
				<div
					className={
						selectedDictId === record.id
							? "cursor-pointer font-medium text-primary"
							: "cursor-pointer"
					}
					onClick={() => handleSelectDict(record.id)}
				>
					<div>{record.name}</div>
					<div className="text-xs text-muted-foreground">{record.slug}</div>
				</div>
			),
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
		{ title: "排序", dataIndex: "sortOrder", key: "sortOrder", width: 60 },
		{
			title: "状态",
			dataIndex: "status",
			key: "status",
			width: 70,
			render: (val: string) => (
				<Tag color={val === "active" ? "green" : "default"}>
					{val === "active" ? "启用" : "禁用"}
				</Tag>
			),
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

	return (
		<AdminPageContent
			title="字典管理"
			extra={
				<Button
					type="primary"
					icon={<PlusOutlined />}
					onClick={() => openDictModal()}
				>
					新建字典
				</Button>
			}
		>
			<Row gutter={16}>
				<Col span={8}>
					<Table
						dataSource={dictList}
						columns={dictColumns}
						rowKey="id"
						size="small"
						pagination={false}
						locale={{ emptyText: "暂无字典" }}
					/>
				</Col>
				<Col span={16}>
					{selectedDictId ? (
						<div>
							<div className="mb-3 flex items-center justify-between">
								<span className="text-sm text-muted-foreground">字典条目</span>
								<Button
									type="primary"
									size="small"
									icon={<PlusOutlined />}
									onClick={() => openItemModal()}
								>
									新建条目
								</Button>
							</div>
							<Table
								dataSource={items}
								columns={itemColumns}
								rowKey="id"
								size="small"
								pagination={false}
								locale={{ emptyText: "暂无条目" }}
							/>
						</div>
					) : (
						<div className="flex items-center justify-center rounded-lg border py-16 text-sm text-muted-foreground">
							请选择左侧字典查看条目
						</div>
					)}
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
						<Input placeholder="唯一标识" disabled={!!editingDict} />
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
					<Form.Item name="sortOrder" label="排序">
						<InputNumber className="w-full" min={0} placeholder="排序序号" />
					</Form.Item>
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
