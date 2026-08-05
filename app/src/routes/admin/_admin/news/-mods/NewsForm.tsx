/**
 * 新闻管理路由自包含表单组件
 * 传入 id 即编辑（自动拉取数据），不传即新建，内部管理表单状态与提交逻辑
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
import { useEffect, useState } from "react";
import { DictSelect } from "#/components/admin/DictSelect";
import { RichEditor } from "#/components/admin/RichEditor";
import { ImageUpload } from "#/components/admin/upload/ImageUpload";
import { createNewsSFn, getNewsByIdSFn, updateNewsSFn } from "./news.functions";

export interface NewsFormValues {
	title: string;
	slug?: string;
	description?: string;
	content?: string;
	externalUrl?: string;
	coverImageId?: string;
	status: "draft" | "published" | "archived";
	isPinned: boolean;
	isRecommended: boolean;
	publishedAt?: dayjs.Dayjs;
	sortOrder?: number;
}

interface NewsFormProps {
	/** 编辑时传入新闻 id，不传为新建模式 */
	id?: string;
	/** 保存成功回调，传入记录 id */
	onSuccess?: (recordId: string) => void;
	/** 保存失败或记录不存在时回调 */
	onError?: (error: Error) => void;
	/** 取消回调 */
	onCancel?: () => void;
}

export function NewsForm({ id, onSuccess, onError, onCancel }: NewsFormProps) {
	const [form] = Form.useForm();
	const [loading, setLoading] = useState(!!id);
	const [submitting, setSubmitting] = useState(false);
	const isEdit = !!id;

	// 编辑模式：拉取数据回填表单
	useEffect(() => {
		if (!id) return;
		let cancelled = false;
		(async () => {
			setLoading(true);
			try {
				const record = await getNewsByIdSFn({ data: { id } });
				if (cancelled) return;
				if (record) {
					form.setFieldsValue({
						title: record.title,
						slug: record.slug,
						description: record.description,
						content: record.content || "",
						externalUrl: record.externalUrl || "",
						coverImageId: record.coverImageId || "",
						status: record.status,
						isPinned: record.isPinned,
						isRecommended: record.isRecommended,
						publishedAt: record.publishedAt
							? dayjs(record.publishedAt)
							: undefined,
						sortOrder: record.sortOrder ?? 0,
					});
				} else {
					onError?.(new Error("新闻不存在"));
				}
			} catch (err) {
				if (!cancelled)
					onError?.(err instanceof Error ? err : new Error("加载失败"));
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [id, form, onError]);

	const handleSubmit = async (values: NewsFormValues) => {
		setSubmitting(true);
		try {
			if (id) {
				const coverImageId = values.coverImageId || undefined;
				await updateNewsSFn({
					data: {
						id,
						title: values.title,
						slug: values.slug || undefined,
						description: values.description || undefined,
						content: values.content || undefined,
						externalUrl: values.externalUrl || undefined,
						coverImageId: coverImageId || null,
						status: values.status as "draft" | "published" | "archived",
						isPinned: values.isPinned || false,
						isRecommended: values.isRecommended || false,
						sortOrder: values.sortOrder ?? 0,
						publishedAt: values.publishedAt
							? values.publishedAt.toISOString()
							: undefined,
					},
				});
				onSuccess?.(id);
			} else {
				const coverImageId = values.coverImageId || undefined;
				const record = await createNewsSFn({
					data: {
						title: values.title,
						slug: values.slug || undefined,
						description: values.description || undefined,
						content: values.content || undefined,
						externalUrl: values.externalUrl || undefined,
						coverImageId: coverImageId || undefined,
						status: values.status as "draft" | "published",
						isPinned: values.isPinned || false,
						isRecommended: values.isRecommended || false,
						sortOrder: values.sortOrder ?? 0,
						publishedAt: values.publishedAt
							? values.publishedAt.toISOString()
							: undefined,
					},
				});
				onSuccess?.(record.id);
			}
		} catch (err) {
			onError?.(err instanceof Error ? err : new Error("保存失败"));
		} finally {
			setSubmitting(false);
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
			form={form}
			layout="vertical"
			onFinish={handleSubmit}
			initialValues={
				!isEdit
					? {
							status: "draft",
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
				<Form.Item name="status" label="状态" className="min-w-28">
					<DictSelect
						dictSlug="news_status"
						excludeValues={!isEdit ? ["archived"] : undefined}
					/>
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

			<Form.Item>
				<div className="flex gap-2">
					<Button type="primary" htmlType="submit" loading={submitting}>
						保存
					</Button>
					{onCancel && <Button onClick={onCancel}>取消</Button>}
				</div>
			</Form.Item>
		</Form>
	);
}
