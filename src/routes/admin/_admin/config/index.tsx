/**
 * 系统配置管理页面：键值对 CRUD（antd Table + Form + Modal）
 */
import {
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
	Flex,
	Form,
	Input,
	Modal,
	message,
	Popconfirm,
	Space,
	Switch,
} from "antd";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { z } from "zod";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import { EditorTypePreview } from "#/components/admin/EditorTypePreview";
import { EditorTypeSelect } from "#/components/admin/EditorTypeSelect";
import {
	FieldTranslationDrawer,
	type TranslatableField,
} from "#/components/admin/FieldTranslationDrawer";
import { JsonImportButton } from "#/components/admin/JsonImportButton";
import { ProTable } from "#/components/admin/ProTable";
import { TypeAwareEditor } from "#/components/admin/TypeAwareEditor";
import type { EditorType } from "#/lib/editor-types/editor-types";
import { downloadFile } from "#/lib/export/export.utils";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import {
	exportConfigsSFn,
	importConfigsSFn,
} from "#/server/config/config.functions";
import {
	type ConfigRecord,
	createConfig,
	deleteConfig,
	getConfigList as getConfigListService,
	updateConfig,
} from "#/server/config/config.server";
import { logOperation } from "#/server/operation-log/operation-log.server";

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

const getConfigListSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.CONFIG_VIEW)])
	.handler(async () => {
		return getConfigListService();
	});

const createConfigSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.CONFIG_CREATE)])
	.inputValidator(createConfigSchema)
	.handler(async ({ data, context }) => {
		const result = await createConfig(data);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "config",
			action: "create",
			targetType: "config",
			targetId: result.id,
			targetName: result.key,
		});
		return { success: true };
	});

const updateConfigSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.CONFIG_EDIT)])
	.inputValidator(updateConfigSchema)
	.handler(async ({ data, context }) => {
		const { id, ...rest } = data;
		await updateConfig(id, rest);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "config",
			action: "update",
			targetType: "config",
			targetId: data.id,
		});
		return { success: true };
	});

const deleteConfigSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.CONFIG_DELETE)])
	.inputValidator(deleteConfigSchema)
	.handler(async ({ data, context }) => {
		await deleteConfig(data.id);
		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "config",
			action: "delete",
			targetType: "config",
			targetId: data.id,
		});
		return { success: true };
	});

export const Route = createFileRoute("/admin/_admin/config/")({
	component: ConfigPage,
	loader: async () => await getConfigListSFn(),
});

/** 系统配置管理页面组件 */
function ConfigPage() {
	const router = useRouter();
	const configs = Route.useLoaderData();
	const [searchText, setSearchText] = useState("");
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
		// 未分组排在最后
		const sorted = Array.from(set)
			.filter((g) => g !== UNGROUPED_KEY)
			.sort();
		if (set.has(UNGROUPED_KEY)) sorted.push(UNGROUPED_KEY);
		return ["全部", ...sorted];
	}, [configs]);

	/** 根据选中分组和搜索文本过滤配置 */
	const filteredConfigs = useMemo(() => {
		let result = configs;
		if (selectedGroup && selectedGroup !== "全部") {
			if (selectedGroup === UNGROUPED_KEY)
				result = result.filter((c) => !c.groupName);
			else result = result.filter((c) => c.groupName === selectedGroup);
		}
		if (searchText) {
			const lower = searchText.toLowerCase();
			result = result.filter(
				(c) =>
					c.key.toLowerCase().includes(lower) ||
					c.value.toLowerCase().includes(lower) ||
					(c.description ?? "").toLowerCase().includes(lower),
			);
		}
		return result;
	}, [configs, selectedGroup, searchText]);

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
				await updateConfigSFn({ data: { id: editing.id, ...values } });
				message.success("配置更新成功");
			} else {
				await createConfigSFn({ data: values });
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
		await deleteConfigSFn({ data: { id } });
		message.success("已删除");
		router.invalidate();
	};

	/** 导出系统配置数据（JSON） */
	const handleExportConfigs = async () => {
		const json = await exportConfigsSFn();
		const timestamp = dayjs().format("YYYY-MM-DD");
		downloadFile(json, `configs_export_${timestamp}.json`, "application/json");
		message.success("导出完成");
	};

	/** 配置项表格列定义 */
	const configColumns = [
		{
			title: "配置键",
			dataIndex: "key",
			key: "key",
			width: 240,
			render: (key: string) => (
				<code className="text-xs text-blue-600 dark:text-blue-400">{key}</code>
			),
		},
		{
			title: "配置值",
			dataIndex: "value",
			key: "value",
			width: 180,
			ellipsis: true,
		},
		{
			title: "值类型",
			dataIndex: "valueType",
			key: "valueType",
			width: 130,
			render: (val: string | null) => (
				<EditorTypePreview valueType={val} fallback="Text" />
			),
		},
		{
			title: "分组",
			dataIndex: "groupName",
			key: "groupName",
			width: 120,
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
			width: 180,
			render: (desc: string | null) => desc || "—",
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
		<AdminPageContent
			title="系统配置"
			extra={
				<Space>
					<Button icon={<DownloadOutlined />} onClick={handleExportConfigs}>
						导出 JSON
					</Button>

					<JsonImportButton
						successMessage="导入完成"
						onImport={async (jsonString) => {
							const data = JSON.parse(jsonString);
							const result = await importConfigsSFn({ data: { data } });
							message.success(
								`导入完成：新增 ${result.created} / 更新 ${result.updated}`,
							);
							router.invalidate();
						}}
					>
						导入 JSON
					</JsonImportButton>

					<Button
						type="primary"
						icon={<PlusOutlined />}
						onClick={() => openModal()}
					>
						新建配置
					</Button>
				</Space>
			}
		>
			<Flex gap={20}>
				<Card
					size="small"
					title="配置分组"
					classNames={{
						root: "flex-[0_0_150px]",
					}}
					styles={{ body: { padding: 0 } }}
				>
					{groupDataSource.length === 0 ? (
						<div className="p-4 text-center text-muted-foreground text-sm">
							暂无分组
						</div>
					) : (
						<div className="divide-y divide-border">
							{groupDataSource.map((record) => {
								const activeKey = selectedGroup ?? "全部";
								const isActive = activeKey === record.key;
								return (
									<div
										key={record.key}
										className={`flex items-center px-3 py-2.5 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
											isActive ? "bg-blue-50/80 dark:bg-blue-950/40" : ""
										}`}
										onClick={() =>
											setSelectedGroup(
												record.key === "全部" ? null : record.key,
											)
										}
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
												<div className="text-xs text-muted-foreground">
													{record.count} 项
												</div>
											</div>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</Card>

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
						<Space>
							<Input.Search
								placeholder="搜索配置键或值"
								allowClear
								size="small"
								style={{ width: 200 }}
								value={searchText}
								onChange={(e) => setSearchText(e.target.value)}
							/>
						</Space>
					}
					classNames={{
						root: "flex-1 min-w-0",
					}}
					styles={{ body: { padding: 0 } }}
				>
					<ProTable
						dataSource={filteredConfigs}
						columns={configColumns}
						scroll={{ x: 1430 }}
						rowKey="id"
						size="small"
						pagination={false}
						locale={{ emptyText: "暂无配置" }}
					/>
				</Card>
			</Flex>

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
						<EditorTypeSelect allowClear placeholder="默认文本" />
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
