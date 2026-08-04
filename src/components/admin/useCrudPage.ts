/**
 * 管理端 CRUD 页面状态机 hook
 * 收敛"列表刷新 + 关键词搜索 + 新建/编辑弹窗 + 表单提交 + 删除"的通用流程，
 * 各页面只需提供 SFn 调用函数与记录↔表单映射
 */

import type { FormInstance } from "antd";
import { Form } from "antd";
import { useState } from "react";
import { safeSfnCall } from "#/components/admin/sfn-helpers";
import { message } from "#/components/antd-static";

/** antd Form.setFieldsValue 的参数类型（RecursivePartial） */
type SetFieldsValueArg<T> = Parameters<FormInstance<T>["setFieldsValue"]>[0];

/** useCrudPage 入参 */
export interface UseCrudPageOptions<TRecord, TFormValues> {
	/** loader 预取的初始列表 */
	initialData: TRecord[];
	/** 按关键词拉取列表（空关键词传空串，由调用方自行处理） */
	load: (keyword: string) => Promise<TRecord[]>;
	/** 提交创建 */
	create: (values: TFormValues) => Promise<unknown>;
	/** 提交更新 */
	update: (id: string, values: TFormValues) => Promise<unknown>;
	/** 删除记录 */
	remove: (id: string) => Promise<unknown>;
	/** 编辑时把记录映射为表单初始值 */
	recordToForm: (record: TRecord) => TFormValues;
	/** 新建时的表单默认值 */
	defaultValues?: SetFieldsValueArg<TFormValues>;
	/** 操作成功提示文案 */
	messages?: { created?: string; updated?: string; deleted?: string };
	/** 记录 id 提取，默认 record.id */
	recordId?: (record: TRecord) => string;
}

/**
 * CRUD 页面状态机
 * 提交失败（SFn 抛错）时 message.error 展示后端错误；删除走 safeSfnCall 统一报错
 */
export function useCrudPage<TRecord, TFormValues>(
	options: UseCrudPageOptions<TRecord, TFormValues>,
) {
	const {
		initialData,
		load,
		create,
		update,
		remove,
		recordToForm,
		defaultValues,
		messages = {},
		recordId = (r) => (r as { id: string }).id,
	} = options;

	const [records, setRecords] = useState<TRecord[]>(initialData);
	const [keyword, setKeyword] = useState("");
	const [modalOpen, setModalOpen] = useState(false);
	const [editingRecord, setEditingRecord] = useState<TRecord | null>(null);
	const [saving, setSaving] = useState(false);
	const [form] = Form.useForm<TFormValues>();

	/** 刷新列表（使用当前关键词） */
	const refresh = async () => {
		setRecords(await load(keyword));
	};

	/** 按当前关键词搜索 */
	const handleSearch = async () => {
		await refresh();
	};

	/** 打开新建弹窗 */
	const openCreateModal = () => {
		setEditingRecord(null);
		form.resetFields();
		if (defaultValues) form.setFieldsValue(defaultValues);
		setModalOpen(true);
	};

	/** 打开编辑弹窗 */
	const openEditModal = (record: TRecord) => {
		setEditingRecord(record);
		// antd RecursivePartial 泛型与 TFormValues 不兼容（antd 类型定义缺陷）
		form.setFieldsValue(recordToForm(record) as SetFieldsValueArg<TFormValues>);
		setModalOpen(true);
	};

	/** 关闭弹窗 */
	const closeModal = () => setModalOpen(false);

	/** 提交表单：校验 → 创建/更新 → 提示 → 刷新 */
	const handleSubmit = async () => {
		try {
			const values = await form.validateFields();
			setSaving(true);
			if (editingRecord) {
				await update(recordId(editingRecord), values);
				message.success(messages.updated ?? "已更新");
			} else {
				await create(values);
				message.success(messages.created ?? "已创建");
			}
			setModalOpen(false);
			await refresh();
		} catch (err) {
			// 表单校验失败抛出的不是 Error，不会误提示；SFn 业务错误在此统一展示
			if (err instanceof Error && err.message) {
				message.error(err.message);
			}
		} finally {
			setSaving(false);
		}
	};

	/** 删除记录：safeSfnCall 统一展示错误，成功则提示并刷新 */
	const handleDelete = async (record: TRecord) => {
		try {
			await safeSfnCall(remove(recordId(record)));
			message.success(messages.deleted ?? "已删除");
			await refresh();
		} catch {
			// error 已由 safeSfnCall 显示
		}
	};

	return {
		records,
		keyword,
		setKeyword,
		modalOpen,
		editingRecord,
		saving,
		form,
		refresh,
		handleSearch,
		openCreateModal,
		openEditModal,
		closeModal,
		handleSubmit,
		handleDelete,
	};
}
