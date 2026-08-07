/**
 * 富文本编辑器（app 业务壳）
 * 纯组件逻辑在 @fsdx/ui-spa/editor，此处注入项目统一的文件上传实现
 * value / onChange 兼容 antd Form.Item 直接注入
 */

import { message } from "@fsdx/ui-spa/antd-static";
import { RichEditor as RichEditorBase } from "@fsdx/ui-spa/editor";
import { useCallback } from "react";
import { uploadFileSFn } from "#/services/file/file.functions";

interface Props {
	value?: string;
	onChange?: (html: string) => void;
}

export function RichEditor({ value = "", onChange }: Props) {
	/** 注入统一上传：写入文件库并返回下载地址；失败时提示用户并向上抛出 */
	const uploadImage = useCallback(async (file: File): Promise<string> => {
		const fd = new FormData();
		fd.append("file", file);
		fd.append("permanent", "true");
		try {
			const result = await uploadFileSFn({ data: fd });
			if (!result?.data?.id) {
				throw new Error("上传未返回文件标识");
			}
			return `/api/download/file/${result.data.id}`;
		} catch (err) {
			const reason = err instanceof Error ? err.message : "未知原因";
			message.error(`图片上传失败：${reason}`);
			throw err;
		}
	}, []);

	return (
		<RichEditorBase
			value={value}
			onChange={onChange}
			uploadImage={uploadImage}
		/>
	);
}
