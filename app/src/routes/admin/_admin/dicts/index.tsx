/**
 * 字典管理页面：字典类型 + 条目 CRUD（antd）
 * 左面板为字典类型（全量），右表格为选中字典的条目（服务端分页 / 排序）
 */

import { DownloadOutlined, PlusOutlined } from "@ant-design/icons";
import { downloadFile } from "@fsdx/lib/export";
import { message } from "@fsdx/ui-spa/antd-static";
import { JsonImportButton } from "@fsdx/ui-spa/json-import-button";
import { ProTable, withDisabledReason } from "@fsdx/ui-spa/table";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Button, Card, Flex, Form } from "antd";
import dayjs from "dayjs";
import { useCallback, useState } from "react";
import {
	AdminListPage,
	AdminTableToolbar,
	useAdminAuth,
} from "#/components/admin";
import { ADMIN_PERMISSIONS } from "#/permissions/admin-permissions";
import type {
	DictItemRecord,
	DictRecord,
} from "#/shared-services/dict/dict.server";
import type { PaginatedResult } from "#/types/query";
import { callSfn, sfnUnwrap } from "#/utils/sfn-error";
import { useListQuery } from "#/utils/use-list-query";
import { DictFormModal } from "./-mods/DictFormModal";
import { DictItemFormModal } from "./-mods/DictItemFormModal";
import { DictListPanel } from "./-mods/DictListPanel";
import { isPresetDict } from "./-mods/dict.utils";
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
	setDictItemStatusSFn,
	updateDictItemSFn,
	updateDictItemSortSFn,
	updateDictSFn,
} from "./-mods/dicts.functions";

export const Route = createFileRoute("/admin/_admin/dicts/")({
	component: DictsPage,
	loader: async () => await getDictListSFn(),
});

/** 未选择字典时的空分页结果（条目按字典 slug 懒加载，不来自 loader） */
const EMPTY_ITEM_PAGE: PaginatedResult<DictItemRecord> = {
	records: [],
	total: 0,
	page: 1,
	pageSize: 20,
};

/** 条目列表筛选条件 */
interface DictItemFilters {
	dictSlug: string;
}

const NO_CREATE_PERMISSION = "无「新建字典」权限";
const NO_CREATE_ITEM_PERMISSION = "无「新建字典条目」权限";

/** 字典管理页面组件 */
function DictsPage() {
	const router = useRouter();
	const dictList = Route.useLoaderData();
	const { hasPermission } = useAdminAuth();
	const [dictModalOpen, setDictModalOpen] = useState(false);
	const [editingDict, setEditingDict] = useState<DictRecord | null>(null);
	const [itemModalOpen, setItemModalOpen] = useState(false);
	const [editingItem, setEditingItem] = useState<DictItemRecord | null>(null);
	const [advancedExpanded, setAdvancedExpanded] = useState(false);
	const [dictForm] = Form.useForm();
	const [itemForm] = Form.useForm();

	const list = useListQuery<DictItemRecord, DictItemFilters>({
		initial: EMPTY_ITEM_PAGE,
		initialFilters: { dictSlug: "" },
		errorMessage: "加载条目失败",
		fetcher: useCallback(
			({ page, pageSize, sortField, sortOrder, filters }) => {
				// 未选择字典时不发请求，直接返回空结果
				if (!filters.dictSlug) return Promise.resolve(EMPTY_ITEM_PAGE);
				return getDictItemsSFn({
					data: {
						dictSlug: filters.dictSlug,
						page,
						pageSize,
						sortField,
						sortOrder,
					},
				});
			},
			[],
		),
	});

	const permissions = {
		create: hasPermission(ADMIN_PERMISSIONS.DICT_CREATE),
		edit: hasPermission(ADMIN_PERMISSIONS.DICT_EDIT),
		delete: hasPermission(ADMIN_PERMISSIONS.DICT_DELETE),
		createItem: hasPermission(ADMIN_PERMISSIONS.DICT_CREATE_ITEM),
		editItem: hasPermission(ADMIN_PERMISSIONS.DICT_EDIT_ITEM),
		deleteItem: hasPermission(ADMIN_PERMISSIONS.DICT_DELETE_ITEM),
		export: hasPermission(ADMIN_PERMISSIONS.DICT_EXPORT),
		import: hasPermission(ADMIN_PERMISSIONS.DICT_IMPORT),
	};

	const selectedDictSlug = list.filters.dictSlug || null;
	const selectedDict = dictList.find((d) => d.slug === selectedDictSlug);

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
				await callSfn(
					updateDictSFn({
						data: {
							id: editingDict.id,
							slug: (values.slug as string) || undefined,
							name: values.name as string,
							description: (values.description as string) || undefined,
						},
					}),
				);
				message.success("字典更新成功");
			} else {
				await callSfn(
					createDictSFn({
						data: {
							name: values.name as string,
							slug: values.slug as string,
							description: (values.description as string) || undefined,
						},
					}),
				);
				message.success("字典创建成功");
			}
			closeDictModal();
			router.invalidate();
		} catch {
			// callSfn 已提示
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
				await callSfn(
					updateDictItemSFn({
						data: {
							id: editingItem.id,
							label: values.label as string,
							value: values.value as string,
							sortOrder: (values.sortOrder as number) ?? 0,
							extraType: (values.extraType as string) || undefined,
							extra: (values.extra as string) || undefined,
							color: (values.color as string) || undefined,
						},
					}),
				);
				message.success("条目更新成功");
			} else {
				await callSfn(
					createDictItemSFn({
						data: {
							dictSlug: selectedDictSlug,
							label: values.label as string,
							value: values.value as string,
							sortOrder: (values.sortOrder as number) ?? 0,
							extraType: (values.extraType as string) || undefined,
							extra: (values.extra as string) || undefined,
							color: (values.color as string) || undefined,
						},
					}),
				);
				message.success("条目创建成功");
			}
			closeItemModal();
			await list.reload();
		} catch {
			// callSfn 已提示
		}
	};

	const handleDeleteDict = async (record: DictRecord) => {
		const [, err] = await sfnUnwrap(
			deleteDictSFn({ data: { id: record.id } }),
			{
				error: "删除失败",
			},
		);
		if (err) return;
		message.success("字典已删除");
		// 删除的是当前选中字典：清空右侧条目并回到未选中态
		if (selectedDict?.id === record.id) {
			list.applyFilters({ dictSlug: "" });
		}
		router.invalidate();
	};

	const handleDeleteItem = async (record: DictItemRecord) => {
		const [, err] = await sfnUnwrap(
			deleteDictItemSFn({ data: { id: record.id } }),
			{ error: "删除失败" },
		);
		if (err) return;
		message.success("条目已删除");
		await list.reload();
	};

	/** 单元格内修改排序权重 */
	const handleChangeSortOrder = async (
		record: DictItemRecord,
		next: number,
	) => {
		await callSfn(
			updateDictItemSortSFn({ data: { id: record.id, sortOrder: next } }),
		);
		await list.reload();
	};

	/** 单元格内切换启用状态 */
	const handleToggleStatus = async (record: DictItemRecord, next: boolean) => {
		await callSfn(
			setDictItemStatusSFn({
				data: { id: record.id, status: next ? "active" : "disabled" },
			}),
		);
		message.success(next ? "已启用" : "已禁用");
		await list.reload();
	};

	/** 导出字典数据（JSON） */
	const handleExportDicts = async () => {
		const [json] = await sfnUnwrap(exportDictsSFn(), { error: "导出失败" });
		if (!json) return;
		const timestamp = dayjs().format("YYYY-MM-DD");
		downloadFile(json, `dicts_export_${timestamp}.json`, "application/json");
		message.success("导出完成");
	};

	/** 字典条目表格列定义 */
	const itemColumns = dictItemColumns({
		sortProps: list.sortProps,
		onChangeSortOrder: handleChangeSortOrder,
		onToggleStatus: handleToggleStatus,
		onEdit: openItemModal,
		onDelete: handleDeleteItem,
		permissions,
	});

	const secondaryActions = (
		<>
			{withDisabledReason(
				<Button
					icon={<DownloadOutlined />}
					disabled={!permissions.export}
					onClick={() => void handleExportDicts()}
				>
					导出 JSON
				</Button>,
				!permissions.export,
				"无「导出字典」权限",
			)}
			{withDisabledReason(
				<JsonImportButton
					disabled={!permissions.import}
					onImport={async (jsonString) => {
						const data = JSON.parse(jsonString);
						const result = await callSfn(importDictsSFn({ data }));
						message.success(
							`导入完成：字典类型 新增 ${result.dictsCreated} / 更新 ${result.dictsUpdated}，` +
								`条目 新增 ${result.itemsCreated} / 更新 ${result.itemsUpdated}` +
								(result.itemsSkipped > 0
									? ` / 跳过 ${result.itemsSkipped}`
									: ""),
						);
						router.invalidate();
						if (selectedDictSlug) await list.reload();
					}}
				>
					导入 JSON
				</JsonImportButton>,
				!permissions.import,
				"无「导入字典」权限",
			)}
		</>
	);

	return (
		<AdminListPage
			title="字典管理"
			description="维护系统字典类型与条目，排序与启用状态可在列表内直接修改"
			extra={withDisabledReason(
				<Button
					type="primary"
					icon={<PlusOutlined />}
					disabled={!permissions.create}
					onClick={() => openDictModal()}
				>
					新建字典
				</Button>,
				!permissions.create,
				NO_CREATE_PERMISSION,
			)}
			toolbar={
				<AdminTableToolbar extra={secondaryActions}>
					<span className="text-sm text-muted-foreground">
						{selectedDictSlug
							? `当前字典：${selectedDict?.name ?? selectedDictSlug}`
							: "选择左侧字典查看条目"}
					</span>
				</AdminTableToolbar>
			}
		>
			<Flex gap={20}>
				<DictListPanel
					dicts={dictList}
					selectedSlug={selectedDictSlug}
					onSelect={(slug) => {
						if (slug !== selectedDictSlug)
							list.applyFilters({ dictSlug: slug });
					}}
					onEdit={openDictModal}
					onDelete={handleDeleteDict}
					permissions={permissions}
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
									· 条目 ({list.data.total})
								</span>
							</span>
						) : (
							"字典条目"
						)
					}
					extra={
						selectedDictSlug
							? withDisabledReason(
									<Button
										type="primary"
										size="small"
										icon={<PlusOutlined />}
										disabled={!permissions.createItem}
										onClick={() => openItemModal()}
									>
										新建条目
									</Button>,
									!permissions.createItem,
									NO_CREATE_ITEM_PERMISSION,
								)
							: undefined
					}
					styles={{ body: { padding: 0 } }}
				>
					{selectedDictSlug ? (
						<ProTable
							dataSource={list.data.records}
							columns={itemColumns}
							rowKey="id"
							loading={list.loading}
							scroll={{ x: 1420 }}
							size="small"
							locale={{ emptyText: "暂无条目" }}
							onChange={list.onTableChange}
							pagination={list.pagination}
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
				isSlugDisabled={!!editingDict && isPresetDict(editingDict.slug)}
				onCancel={closeDictModal}
				onSubmit={handleDictSubmit}
			/>

			<DictItemFormModal
				open={itemModalOpen}
				editing={editingItem}
				form={itemForm}
				isValueDisabled={!!editingItem && isPresetDict(editingItem.dictSlug)}
				isAdvancedExpanded={advancedExpanded}
				onToggleAdvanced={() => setAdvancedExpanded(!advancedExpanded)}
				onCancel={closeItemModal}
				onSubmit={handleItemSubmit}
			/>
		</AdminListPage>
	);
}
