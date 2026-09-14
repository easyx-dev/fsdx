/**
 * 系统配置管理页面：键值对 CRUD（antd Table + Form + Modal）
 */
import { DownloadOutlined, PlusOutlined } from "@ant-design/icons";
import { downloadFile } from "@fsdx/lib/export";
import { message } from "@fsdx/ui-spa/antd-static";
import { JsonImportButton } from "@fsdx/ui-spa/json-import-button";
import { ProTable } from "@fsdx/ui-spa/table";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Button, Card, Flex, Form, Input, Space } from "antd";
import dayjs from "dayjs";
import type { ChangeEvent } from "react";
import { useMemo, useState } from "react";
import { AdminPageContent } from "#/components/admin";
import type { ConfigRecord } from "#/shared-services/config/config.server";
import { callSfn } from "#/utils/sfn-error";
import { ConfigFormModal } from "./-mods/ConfigFormModal";
import {
	createConfigSFn,
	deleteConfigSFn,
	exportConfigsSFn,
	getConfigListSFn,
	importConfigsSFn,
	updateConfigSFn,
} from "./-mods/config.functions";
import { configColumns } from "./-mods/configColumns";

const UNGROUPED_KEY = "__ungrouped__";

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
					// 敏感配置值已脱敏，不参与值匹配
					(!c.isSecret && c.value.toLowerCase().includes(lower)) ||
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
				// 敏感配置不回显密文，留空表示保留原值
				value: record.isSecret ? "" : record.value,
				isSecret: record.isSecret,
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
				await callSfn(
					updateConfigSFn({
						data: {
							id: editing.id,
							valueType: values.valueType,
							groupName: values.groupName,
							description: values.description,
							clientVisible: values.clientVisible,
							// 敏感配置留空表示保留原密文（undefined 不覆盖 value）
							value:
								editing.isSecret && !values.value ? undefined : values.value,
						},
					}),
				);
				message.success("配置更新成功");
			} else {
				await callSfn(createConfigSFn({ data: values }));
				message.success("配置创建成功");
			}
			closeModal();
			router.invalidate();
		} catch {
			// 表单校验由 antd 提示，SFn 失败由 callSfn 统一提示
		}
	};

	/** 删除配置 */
	const handleDelete = async (id: string) => {
		try {
			await callSfn(deleteConfigSFn({ data: { id } }));
			message.success("已删除");
			router.invalidate();
		} catch {
			// callSfn 已提示
		}
	};

	/** 导出系统配置数据（JSON） */
	const handleExportConfigs = async () => {
		try {
			const json = await callSfn(exportConfigsSFn());
			const timestamp = dayjs().format("YYYY-MM-DD");
			downloadFile(
				json,
				`configs_export_${timestamp}.json`,
				"application/json",
			);
			message.success("导出完成");
		} catch {
			// callSfn 已提示
		}
	};

	const configColumnsDef = configColumns({
		onEdit: openModal,
		onDelete: handleDelete,
	});

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
							const result = await callSfn(importConfigsSFn({ data }));
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
										className={`flex items-center px-3 py-2.5 cursor-pointer transition-colors hover:bg-accent ${
											isActive ? "bg-primary-bg" : ""
										}`}
										onClick={() =>
											setSelectedGroup(
												record.key === "全部" ? null : record.key,
											)
										}
									>
										<div className="flex items-center gap-2 min-w-0">
											{isActive && (
												<span className="w-1 h-6 rounded-full bg-primary flex-shrink-0" />
											)}
											<div className="min-w-0">
												<div
													className={
														isActive
															? "font-semibold text-primary truncate"
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
								onChange={(e: ChangeEvent<HTMLInputElement>) =>
									setSearchText(e.target.value)
								}
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
						columns={configColumnsDef}
						scroll={{ x: 1500 }}
						rowKey="id"
						size="small"
						pagination={false}
						locale={{ emptyText: "暂无配置" }}
					/>
				</Card>
			</Flex>

			<ConfigFormModal
				open={modalOpen}
				editing={editing}
				form={form}
				onCancel={closeModal}
				onSubmit={handleSubmit}
			/>
		</AdminPageContent>
	);
}
