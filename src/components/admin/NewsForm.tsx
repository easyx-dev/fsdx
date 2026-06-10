/**
 * 新闻表单共享组件
 * 管理端创建 / 编辑新闻页面通用表单，消除两处页面中的重复 Form 结构
 */

import type { FormInstance } from "antd";
import { Button, Form, Input, Switch } from "antd";
import { DictSelect } from "#/components/admin/DictSelect";
import { RichEditor } from "#/components/admin/RichEditor";

export interface NewsFormValues {
	title: string;
	slug?: string;
	summary?: string;
	content?: string;
	status: "draft" | "published" | "archived";
	isPinned: boolean;
}

interface NewsFormProps {
	/** 模式：创建或编辑 */
	mode: "create" | "edit";
	/** 表单实例 */
	form: FormInstance;
	/** 初始值（编辑时传入已加载的新闻数据） */
	initialValues?: Partial<NewsFormValues>;
	/** 保存回调 */
	onSubmit: (values: NewsFormValues) => void;
	/** 取消回调 */
	onCancel: () => void;
	/** 保存中 */
	submitting?: boolean;
}

export function NewsForm({
	mode,
	form,
	initialValues,
	onSubmit,
	onCancel,
	submitting,
}: NewsFormProps) {
	return (
		<Form
			form={form}
			layout="vertical"
			onFinish={onSubmit}
			initialValues={initialValues}
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
				extra={mode === "create" ? "留空自动生成" : undefined}
			>
				<Input placeholder="自动生成" style={{ fontFamily: "monospace" }} />
			</Form.Item>

			<Form.Item name="summary" label="摘要">
				<Input.TextArea rows={2} placeholder="新闻摘要（可选）" />
			</Form.Item>

			<Form.Item name="content" label="正文">
				<RichEditor />
			</Form.Item>

			<div className="flex gap-8">
				<Form.Item name="status" label="状态" className="min-w-28">
					<DictSelect
						dictSlug="news_status"
						excludeValues={mode === "create" ? ["archived"] : undefined}
					/>
				</Form.Item>

				<Form.Item name="isPinned" label="置顶" valuePropName="checked">
					<Switch />
				</Form.Item>
			</div>

			<Form.Item>
				<div className="flex gap-2">
					<Button type="primary" htmlType="submit" loading={submitting}>
						保存
					</Button>
					<Button onClick={onCancel}>取消</Button>
				</div>
			</Form.Item>
		</Form>
	);
}
