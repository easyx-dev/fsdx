/**
 * 新闻管理路由自包含表单组件
 * 传入 id 即编辑（自动拉取数据），不传即新建，内部管理表单状态与提交逻辑
 * 回调以 ref 承载最新引用，避免父级重渲染导致回填 effect 重跑（会覆盖用户正在编辑的内容）
 */

import {
	Button,
	DatePicker,
	Form,
	Input,
	InputNumber,
	Spin,
	Switch,
} from "antd";
import dayjs from "dayjs";
import { useEffect, useRef, useState } from "react";
import { ImageUpload, RichEditor } from "#/components/admin";
import { callSfn } from "#/utils/sfn-error";
import { createNewsSFn, getNewsByIdSFn, updateNewsSFn } from "./news.functions";

export interface NewsFormValues {
	title: string;
	slug?: string;
	description?: string;
	content?: string;
	externalUrl?: string;
	coverImageId?: string;
	isPublished: boolean;
	isPinned: boolean;
	isRecommended: boolean;
	publishedAt?: dayjs.Dayjs;
	sortOrder?: number;
}

interface NewsFormProps {
	/** 编辑时传入新闻 id，不传为新建模式 */
	id?: string;
	/** <form id>：宿主（AdminFormDrawer）以底部按钮提交时传入 */
	formId?: string;
	/** 隐藏表单自带操作按钮（宿主已提供吸底按钮时使用） */
	hideActions?: boolean;
	/** 提交中状态回传（宿主据此控制底部按钮 loading） */
	onSubmittingChange?: (submitting: boolean) => void;
	/** 保存成功回调，传入记录 id */
	onSuccess?: (recordId: string) => void;
	/** 保存失败或记录不存在时回调 */
	onError?: (error: Error) => void;
	/** 取消回调 */
	onCancel?: () => void;
}

export function NewsForm({
	id,
	formId,
	hideActions,
	onSubmittingChange,
	onSuccess,
	onError,
	onCancel,
}: NewsFormProps) {
	const [form] = Form.useForm();
	const [loading, setLoading] = useState(!!id);
	const [submitting, setSubmitting] = useState(false);
	const isEdit = !!id;
	// 回调放进 ref：回填 effect 只依赖 id / form，父级每次渲染换新函数也不会重跑
	const onErrorRef = useRef(onError);
	onErrorRef.current = onError;

	// 编辑模式：拉取数据回填表单
	useEffect(() => {
		if (!id) return;
		let cancelled = false;
		(async () => {
			setLoading(true);
			try {
				const record = await callSfn(getNewsByIdSFn({ data: { id } }));
				if (cancelled) return;
				if (record) {
					form.setFieldsValue({
						title: record.title,
						slug: record.slug,
						description: record.description,
						content: record.content || "",
						externalUrl: record.externalUrl || "",
						coverImageId: record.coverImageId || "",
						isPublished: record.isPublished,
						isPinned: record.isPinned,
						isRecommended: record.isRecommended,
						publishedAt: record.publishedAt
							? dayjs(record.publishedAt)
							: undefined,
						sortOrder: record.sortOrder ?? 0,
					});
				} else {
					onErrorRef.current?.(new Error("新闻不存在"));
				}
			} catch {
				// callSfn 已提示
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [id, form]);

	const handleSubmit = async (values: NewsFormValues) => {
		setSubmitting(true);
		onSubmittingChange?.(true);
		try {
			if (id) {
				const coverImageId = values.coverImageId || undefined;
				await callSfn(
					updateNewsSFn({
						data: {
							id,
							title: values.title,
							slug: values.slug || undefined,
							description: values.description || undefined,
							content: values.content || undefined,
							externalUrl: values.externalUrl || undefined,
							coverImageId: coverImageId || null,
							isPublished: values.isPublished,
							isPinned: values.isPinned || false,
							isRecommended: values.isRecommended || false,
							sortOrder: values.sortOrder ?? 0,
							publishedAt: values.publishedAt
								? values.publishedAt.toISOString()
								: undefined,
						},
					}),
				);
				onSuccess?.(id);
			} else {
				const coverImageId = values.coverImageId || undefined;
				const record = await callSfn(
					createNewsSFn({
						data: {
							title: values.title,
							slug: values.slug || undefined,
							description: values.description || undefined,
							content: values.content || undefined,
							externalUrl: values.externalUrl || undefined,
							coverImageId: coverImageId || undefined,
							isPublished: values.isPublished,
							isPinned: values.isPinned || false,
							isRecommended: values.isRecommended || false,
							sortOrder: values.sortOrder ?? 0,
							publishedAt: values.publishedAt
								? values.publishedAt.toISOString()
								: undefined,
						},
					}),
				);
				onSuccess?.(record.id);
			}
		} catch {
			// callSfn 已提示
		} finally {
			setSubmitting(false);
			onSubmittingChange?.(false);
		}
	};

	if (loading) {
		return (
			<div className="flex justify-center py-20">
				<Spin />
			</div>
		);
	}

	return (
		<Form
			id={formId}
			form={form}
			layout="vertical"
			onFinish={handleSubmit}
			initialValues={
				!isEdit
					? {
							isPublished: false,
							isPinned: false,
							isRecommended: false,
							content: "",
						}
					: undefined
			}
		>
			<Form.Item
				name="title"
				label="标题"
				rules={[{ required: true, message: "请输入标题" }]}
			>
				<Input placeholder="新闻标题" />
			</Form.Item>

			<Form.Item
				name="slug"
				label="Slug"
				extra={!isEdit ? "留空自动生成" : undefined}
			>
				<Input placeholder="自动生成" style={{ fontFamily: "monospace" }} />
			</Form.Item>

			<Form.Item name="description" label="摘要">
				<Input.TextArea rows={2} placeholder="新闻摘要（可选）" />
			</Form.Item>

			<Form.Item name="coverImageId" label="封面图片">
				<ImageUpload />
			</Form.Item>

			<Form.Item
				name="content"
				label="正文"
				extra="内部文章填写此栏，有外部链接时以链接为准"
			>
				<RichEditor />
			</Form.Item>

			<Form.Item
				name="externalUrl"
				label="外部链接"
				extra="外部链接优先（如微信公众号链接），前台点击直接跳转外链"
			>
				<Input placeholder="https://mp.weixin.qq.com/s/..." />
			</Form.Item>

			<div className="flex gap-8">
				<Form.Item
					name="isPublished"
					label="发布"
					valuePropName="checked"
					className="min-w-28"
				>
					<Switch />
				</Form.Item>

				<Form.Item name="isPinned" label="置顶" valuePropName="checked">
					<Switch />
				</Form.Item>

				<Form.Item
					name="isRecommended"
					label="首页推荐"
					valuePropName="checked"
					extra="最多5条"
				>
					<Switch />
				</Form.Item>

				<Form.Item name="sortOrder" label="排序" extra="数字越大越靠前">
					<InputNumber min={0} style={{ width: 120 }} />
				</Form.Item>

				<Form.Item
					name="publishedAt"
					label="发布时间"
					extra="留空则在发布时自动设为当前时间"
				>
					<DatePicker
						showTime
						format="YYYY-MM-DD HH:mm"
						style={{ width: 220 }}
					/>
				</Form.Item>
			</div>

			{/* 宿主（AdminFormDrawer）提供吸底按钮时隐藏自带操作 */}
			{!hideActions && (
				<Form.Item>
					<div className="flex gap-2">
						<Button type="primary" htmlType="submit" loading={submitting}>
							保存
						</Button>
						{onCancel && <Button onClick={onCancel}>取消</Button>}
					</div>
				</Form.Item>
			)}
		</Form>
	);
}
