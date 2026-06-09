/**
 * 系统配置管理页面：键值对 CRUD（antd Table + Form + Modal）
 */
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
	Button,
	Card,
	Col,
	Form,
	Input,
	Modal,
	message,
	Popconfirm,
	Row,
	Select,
	Space,
	Switch,
	Table,
} from "antd";
import { useMemo, useState } from "react";
import { z } from "zod";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import {
	FieldTranslationDrawer,
	type TranslatableField,
} from "#/components/admin/FieldTranslationDrawer";
import { TypeAwareEditor } from "#/components/admin/TypeAwareEditor";
import type { EditorType } from "#/lib/editor-types/editor-types";
import {
	EDITOR_TYPE_LABELS,
	EDITOR_TYPES,
} from "#/lib/editor-types/editor-types";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { permGuard } from "#/middleware/server-fn-auth";
import {
	type ConfigRecord,
	createConfig,
	deleteConfig,
	getConfigList as getConfigListService,
	updateConfig,
} from "#/server/config/config.server";

const UNGROUPED_KEY = "__ungrouped__";

/** 系统配置可翻译字段定义 */
const CONFIG_TRANSLATABLE_FIELDS: TranslatableField[] = [
	{ name: "value", label: "配置值", valueType: "text" },
];

const createConfigSchema = z.object({
	key: z.string().min(1, "配置键不能为空").max(100),
	value: z.string().min(1, "配置值不能为空"),
	clientVisible: z.boolean().optional(),
	valueType: z.string().optional(),
	groupName: z.string().optional(),
	description: z.string().optional(),
});
const updateConfigSchema = z.object({
	id: z.string().min(1),
	value: z.string().optional(),
	clientVisible: z.boolean().optional(),
	valueType: z.string().optional(),
	groupName: z.string().optional(),
	description: z.string().optional(),
});
const deleteConfigSchema = z.object({ id: z.string().min(1) });

const getConfigList = createServerFn({ method: "GET" })
	.middleware([permGuard(PERMISSIONS.CONFIG_VIEW)])
	.handler(async () => {
		return getConfigListService();
	});

const createConfigFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.CONFIG_CREATE)])
	.inputValidator(createConfigSchema)
	.handler(async ({ data }) => {
		await createConfig(data);
		return { success: true };
	});

const updateConfigFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.CONFIG_EDIT)])
	.inputValidator(updateConfigSchema)
	.handler(async ({ data }) => {
		const { id, ...rest } = data;
		await updateConfig(id, rest);
		return { success: true };
	});

const deleteConfigFn = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.CONFIG_DELETE)])
	.inputValidator(deleteConfigSchema)
	.handler(async ({ data }) => {
		await deleteConfig(data.id);
		return { success: true };
	});

export const Route = createFileRoute("/admin/_admin/config/")({
	component: ConfigPage,
	loader: async () => await getConfigList(),
});

/** 系统配置管理页面组件 */
function ConfigPage() {
	const router = useRouter();
	const configs = Route.useLoaderData();
	const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
	const [modalOpen, setModalOpen] = useState(false);
	const [editing, setEditing] = useState<ConfigRecord | null>(null);
	const [form] = Form.useForm();
	const watchedValueType = Form.useWatch("valueType", form) as
		| EditorType
		| undefined;

	/** 从配置数据中提取分组列表 */
	const groups = useMemo(() => {
		const set = new Set<string>();
		for (const c of configs) {
			if (c.groupName) set.add(c.groupName);
			else set.add(UNGROUPED_KEY);
		}
		return ["全部", ...Array.from(set).sort()];
	}, [configs]);

	/** 根据选中分组过滤配置 */
	const filteredConfigs = useMemo(() => {
		if (!selectedGroup || selectedGroup === "全部") return configs;
		if (selectedGroup === UNGROUPED_KEY)
			return configs.filter((c) => !c.groupName);
		return configs.filter((c) => c.groupName === selectedGroup);
	}, [configs, selectedGroup]);

	/** 分组列表数据源 */
	const groupDataSource = useMemo(
		() =>
			groups.map((g) => ({
				key: g,
				name: g === UNGROUPED_KEY ? "未分组" : g,
				count:
					g === "全部"
						? configs.length
						: g === UNGROUPED_KEY
							? configs.filter((c) => !c.groupName).length
							: configs.filter((c) => c.groupName === g).length,
			})),
		[groups, configs],
	);

	/** 打开新建/编辑弹窗 */
	const openModal = (record?: ConfigRecord) => {
		if (record) {
			setEditing(record);
			form.setFieldsValue({
				key: record.key,
				value: record.value,
				clientVisible: record.clientVisible,
				valueType: record.valueType ?? undefined,
				groupName: record.groupName ?? undefined,
				description: record.description ?? undefined,
			});
		} else {
			setEditing(null);
			form.resetFields();
		}
		setModalOpen(true);
	};

	/** 关闭弹窗并清理表单 */
	const closeModal = () => {
		setModalOpen(false);
		setEditing(null);
		form.resetFields();
	};

	/** 提交表单 */
	const handleSubmit = async () => {
		try {
			const values = await form.validateFields();
			if (editing) {
				await updateConfigFn({ data: { id: editing.id, ...values } });
				message.success("配置更新成功");
			} else {
				await createConfigFn({ data: values });
				message.success("配置创建成功");
			}
			closeModal();
			router.invalidate();
		} catch (err) {
			if (err instanceof Error && err.message !== "VALIDATE_ERROR") {
				message.error(err.message || "操作失败");
			}
		}
	};

	/** 删除配置 */
	const handleDelete = async (id: string) => {
		await deleteConfigFn({ data: { id } });
		message.success("已删除");
		router.invalidate();
	};

	/** 分组列表表格列定义 */
	const groupColumns = [
		{
			title: "分组",
			dataIndex: "name",
			key: "name",
			render: (
				name: string,
				record: { key: string; name: string; count: number },
			) => {
				const isActive = (selectedGroup ?? "全部") === record.key;
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
								{name}
							</div>
							<div className="text-xs text-muted-foreground">
								{record.count} 项
							</div>
						</div>
					</div>
				);
			},
		},
	];

	/** 配置项表格列定义 */
	const configColumns = [
		{
			title: "配置键",
			dataIndex: "key",
			key: "key",
			width: 200,
			render: (key: string) => (
				<code className="text-xs text-blue-600 dark:text-blue-400">{key}</code>
			),
		},
		{
			title: "配置值",
			dataIndex: "value",
			key: "value",
			ellipsis: true,
			render: (value: string) => (
				<span className="text-xs max-w-[300px] truncate inline-block">
					{value}
				</span>
			),
		},
		{
			title: "值类型",
			dataIndex: "valueType",
			key: "valueType",
			width: 110,
			render: (val: string | null) =>
				val ? (EDITOR_TYPE_LABELS[val as EditorType] ?? val) : "Text",
		},
		{
			title: "分组",
			dataIndex: "groupName",
			key: "groupName",
			width: 100,
			render: (val: string | null) => val || "未分组",
		},
		{
			title: "客户端可见",
			dataIndex: "clientVisible",
			key: "clientVisible",
			width: 100,
			render: (val: boolean) => (val ? "是" : "否"),
		},
		{
			title: "描述",
			dataIndex: "description",
			key: "description",
			ellipsis: true,
			render: (desc: string | null) => desc || "—",
		},
		{
			title: "操作",
			key: "actions",
			width: 160,
			render: (_: unknown, record: ConfigRecord) => {
				// 确保 clientVisible 为真时才显示翻译入口
				const showTranslation = record.clientVisible === true;
				return (
					<Space size={4}>
						<Button
							type="link"
							size="small"
							icon={<EditOutlined />}
							onClick={() => openModal(record)}
						/>
						<Popconfirm
							title="确定删除该配置？"
							onConfirm={() => handleDelete(record.id)}
						>
							<Button
								type="link"
								size="small"
								danger
								icon={<DeleteOutlined />}
							/>
						</Popconfirm>
						{showTranslation && (
							<FieldTranslationDrawer
								entityType="system_config"
								entityId={record.id}
								fields={CONFIG_TRANSLATABLE_FIELDS}
								originalValues={{ value: record.value }}
							/>
						)}
					</Space>
				);
			},
		},
	];

	const activeGroupName =
		!selectedGroup || selectedGroup === "全部"
			? "全部"
			: selectedGroup === UNGROUPED_KEY
				? "未分组"
				: selectedGroup;

	return (
		<AdminPageContent title="系统配置">
			<Row gutter={20}>
				<Col span={6}>
					<Card size="small" title="配置分组" styles={{ body: { padding: 0 } }}>
						<Table
							dataSource={groupDataSource}
							columns={groupColumns}
							rowKey="key"
							size="small"
							showHeader={false}
							pagination={false}
							locale={{ emptyText: "暂无分组" }}
							onRow={(record) => ({
								onClick: () =>
									setSelectedGroup(record.key === "全部" ? null : record.key),
								style: { cursor: "pointer" },
							})}
							rowClassName={(record) =>
								(selectedGroup ?? "全部") === record.key
									? "bg-blue-50/80 dark:bg-blue-950/40"
									: ""
							}
						/>
					</Card>
				</Col>
				<Col span={18}>
					<Card
						size="small"
						title={
							<span className="text-sm">
								<span className="font-medium">{activeGroupName}</span>
								<span className="text-muted-foreground ml-2">
									· 配置项 ({filteredConfigs.length})
								</span>
							</span>
						}
						extra={
							<Button
								type="primary"
								size="small"
								icon={<PlusOutlined />}
								onClick={() => openModal()}
							>
								新建配置
							</Button>
						}
						styles={{ body: { padding: 0 } }}
					>
						<Table
							dataSource={filteredConfigs}
							columns={configColumns}
							rowKey="id"
							size="small"
							locale={{ emptyText: "暂无配置" }}
						/>
					</Card>
				</Col>
			</Row>

			<Modal
				title={editing ? "编辑配置" : "新建配置"}
				open={modalOpen}
				onCancel={closeModal}
				footer={null}
				destroyOnHidden
			>
				<Form
					form={form}
					layout="vertical"
					onFinish={handleSubmit}
					className="mt-4"
				>
					<Form.Item
						name="key"
						label="配置键"
						rules={[
							{ required: true, message: "请输入配置键" },
							{ max: 100, message: "配置键不能超过100个字符" },
						]}
					>
						<Input
							disabled={!!editing}
							placeholder="配置键"
							style={{ fontFamily: "monospace" }}
						/>
					</Form.Item>
					<Form.Item name="valueType" label="值类型">
						<Select
							allowClear
							placeholder="默认文本"
							options={EDITOR_TYPES.map((t) => ({
								label: EDITOR_TYPE_LABELS[t],
								value: t,
							}))}
						/>
					</Form.Item>
					{watchedValueType ? (
						<Form.Item
							name="value"
							label="配置值"
							rules={[{ required: true, message: "请输入配置值" }]}
						>
							<TypeAwareEditor type={watchedValueType} placeholder="配置值" />
						</Form.Item>
					) : (
						<Form.Item
							name="value"
							label="配置值"
							rules={[{ required: true, message: "请输入配置值" }]}
						>
							<Input.TextArea rows={4} placeholder="配置值" />
						</Form.Item>
					)}
					<Form.Item name="groupName" label="配置分组">
						<Input placeholder="分组（可选，为空归入未分组）" />
					</Form.Item>
					<Form.Item
						name="clientVisible"
						label="客户端可见"
						valuePropName="checked"
					>
						<Switch />
					</Form.Item>
					<Form.Item name="description" label="描述">
						<Input.TextArea rows={2} placeholder="描述（可选）" />
					</Form.Item>
					<Form.Item className="mb-0 text-right">
						<Space>
							<Button onClick={closeModal}>取消</Button>
							<Button type="primary" htmlType="submit">
								{editing ? "保存" : "创建"}
							</Button>
						</Space>
					</Form.Item>
				</Form>
			</Modal>
		</AdminPageContent>
	);
}
