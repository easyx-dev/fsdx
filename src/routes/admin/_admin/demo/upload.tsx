/**
 * 上传组件演示页面：展示 ImageUpload 和 FileUpload 各种使用场景
 */
import { createFileRoute } from "@tanstack/react-router";
import { Button, Card, Divider, Form, Space } from "antd";
import { useState } from "react";
import { AdminPageContent } from "#/components/admin/AdminPageContent";
import { FileUpload, ImageUpload } from "#/components/admin/upload";
import { message } from "#/components/antd-static";

export const Route = createFileRoute("/admin/_admin/demo/upload")({
	component: UploadDemoPage,
});

function UploadDemoPage() {
	const [form] = Form.useForm();
	const [submitted, setSubmitted] = useState<Record<string, unknown> | null>(
		null,
	);

	const handleFinish = (values: Record<string, unknown>) => {
		setSubmitted(values);
		message.success("表单提交成功，查看下方结果");
	};

	const handleReset = () => {
		form.resetFields();
		setSubmitted(null);
	};

	return (
		<AdminPageContent
			title="上传组件演示"
			description="展示 ImageUpload（照片墙）和 FileUpload（拖拽/按钮）的各种使用场景"
		>
			<Form
				form={form}
				layout="vertical"
				onFinish={handleFinish}
				style={{ maxWidth: 800 }}
			>
				{/* ── ImageUpload ── */}
				<Card
					title="ImageUpload — 图片上传（照片墙）"
					style={{ marginBottom: 16 }}
				>
					<Form.Item
						name="coverImageId"
						label="封面图（单选）"
						tooltip="maxCount=1，默认 accept=image/*"
					>
						<ImageUpload />
					</Form.Item>

					<Divider />

					<Form.Item
						name="galleryIds"
						label="图片画廊（多选，最多 6 张）"
						tooltip="maxCount=6，支持拖拽排序"
					>
						<ImageUpload maxCount={6} />
					</Form.Item>
				</Card>

				{/* ── FileUpload ── */}
				<Card title="FileUpload — 拖拽区上传" style={{ marginBottom: 16 }}>
					<Form.Item
						name="attachmentId"
						label="附件（单选，拖拽区模式）"
						tooltip="type=drag，默认 listType=text"
					>
						<FileUpload type="drag" />
					</Form.Item>

					<Divider />

					<Form.Item
						name="attachmentIds"
						label="多附件（多选，拖拽区模式，最多 5 个）"
						tooltip="maxCount=5，type=drag，支持拖拽排序"
					>
						<FileUpload type="drag" maxCount={5} />
					</Form.Item>

					<Divider />

					<Form.Item
						name="pdfFileId"
						label="PDF 文件（仅接受 PDF，拖拽区模式）"
						tooltip="accept=application/pdf，仅展示并接受 PDF 文件"
					>
						<FileUpload type="drag" accept="application/pdf" />
					</Form.Item>
				</Card>

				<Card title="FileUpload — 按钮上传" style={{ marginBottom: 16 }}>
					<Form.Item
						name="singleFileId"
						label="单文件（按钮模式）"
						tooltip="type=button"
					>
						<FileUpload type="button" />
					</Form.Item>

					<Divider />

					<Form.Item
						name="multiFileIds"
						label="多文件（按钮模式，最多 5 个）"
						tooltip="type=button，maxCount=5"
					>
						<FileUpload type="button" maxCount={5} />
					</Form.Item>

					<Divider />

					<Form.Item
						name="imageFileId"
						label="图片文件（按钮模式，listType=picture）"
						tooltip="type=button，listType=picture，accept=image/*"
					>
						<FileUpload type="button" listType="picture" accept="image/*" />
					</Form.Item>
				</Card>

				<Space style={{ marginBottom: 24 }}>
					<Button type="primary" htmlType="submit">
						提交表单
					</Button>
					<Button onClick={handleReset}>重置</Button>
				</Space>
			</Form>

			{/* 提交结果展示 */}
			{submitted && (
				<Card
					title="表单提交结果"
					size="small"
					style={{
						maxWidth: 800,
					}}
				>
					<pre
						style={{
							margin: 0,
							fontSize: 13,
							whiteSpace: "pre-wrap",
							wordBreak: "break-all",
						}}
					>
						{JSON.stringify(submitted, null, 2)}
					</pre>
				</Card>
			)}
		</AdminPageContent>
	);
}
