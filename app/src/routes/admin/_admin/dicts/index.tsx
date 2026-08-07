/**
 * 字典管理页面：字典类型 + 条目 CRUD（antd）
 */

import { DownloadOutlined, PlusOutlined } from "@ant-design/icons";
import { downloadFile } from "@fsdx/core/export";
import { message } from "@fsdx/ui-spa/antd-static";
import { JsonImportButton } from "@fsdx/ui-spa/json-import-button";
import { ProTable } from "@fsdx/ui-spa/table";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Button, Card, Flex, Form, Space } from "antd";
import dayjs from "dayjs";
import { useState } from "react";
import { AdminPageContent } from "#/components/admin";
import type { DictItemRecord, DictRecord } from "#/services/dict/dict.server";
import { DictFormModal } from "./-mods/DictFormModal";
import { DictItemFormModal } from "./-mods/DictItemFormModal";
import { DictListPanel } from "./-mods/DictListPanel";
import { dictItemColumns } from "./-mods/dictColumns";
import {
	createDictItemSFn,
	createDictSFn,
	deleteDictItemSFn,
	deleteDictSFn,
	exportDictsSFn,
	getDictItemsSFn,
	getDictListSFn,
	importDictsSFn,
	updateDictItemSFn,
	updateDictSFn,
} from "./-mods/dicts.functions";
import { isPresetDict } from "./-mods/dictUtils";

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
	const itemColumns = dictItemColumns({
		onInlineUpdate: handleInlineUpdate,
		onEdit: openItemModal,
		onDelete: handleDeleteItem,
	});

	const selectedDict = dictList.find((d) => d.slug === selectedDictSlug);

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
							const result = await importDictsSFn({ data });
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
				<DictListPanel
					dicts={dictList}
					selectedSlug={selectedDictSlug}
					onSelect={handleSelectDict}
					onCreate={() => openDictModal()}
					onEdit={openDictModal}
					onDelete={(record) => handleDeleteDict(record.id)}
				/>
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

			<DictFormModal
				open={dictModalOpen}
				editing={editingDict}
				form={dictForm}
				slugDisabled={!!editingDict && isPresetDict(editingDict.slug)}
				onCancel={closeDictModal}
				onSubmit={handleDictSubmit}
			/>

			<DictItemFormModal
				open={itemModalOpen}
				editing={editingItem}
				form={itemForm}
				valueDisabled={!!editingItem && isPresetDict(editingItem.dictSlug)}
				advancedExpanded={advancedExpanded}
				onToggleAdvanced={() => setAdvancedExpanded(!advancedExpanded)}
				onCancel={closeItemModal}
				onSubmit={handleItemSubmit}
			/>
		</AdminPageContent>
	);
}
