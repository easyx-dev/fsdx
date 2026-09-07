/**
 * 富文本编辑器（app 业务壳）
 * 纯组件逻辑在 @fsdx/ui-spa/editor，此处注入项目统一的文件上传与媒体库列表实现
 * value / onChange 兼容 antd Form.Item 直接注入
 */

import { message } from "@fsdx/ui-spa/antd-static";
import type { RichEditorMedia } from "@fsdx/ui-spa/editor";
import { RichEditor as RichEditorBase } from "@fsdx/ui-spa/editor";
import { getFileListSFn, uploadFileSFn } from "#/services/file/file.functions";

interface RichEditorProps {
	value?: string;
	onChange?: (html: string) => void;
}

/** 上传单个文件到文件库（永久），返回可插入编辑器的读取地址；失败时提示并向上抛出 */
const uploadMedia = async (file: File): Promise<string> => {
	const fd = new FormData();
	fd.append("file", file);
	fd.append("permanent", "true");
	try {
		const result = await uploadFileSFn({ data: fd });
		if (!result?.data?.id) {
			throw new Error("上传未返回文件标识");
		}
		return `/file/r/${result.data.id}`;
	} catch (err) {
		const reason = err instanceof Error ? err.message : "未知原因";
		message.error(`上传失败：${reason}`);
		throw err;
	}
};

/** 媒体库列表：按媒体类型前缀分页拉取永久文件，映射为编辑器媒体项 */
const getMediaList: RichEditorMedia["getList"] = async ({
	mimePrefix,
	excludeMimePrefixes,
	keyword,
	page,
	pageSize,
}) => {
	const result = await getFileListSFn({
		data: {
			keyword,
			mimePrefix,
			excludeMimePrefixes,
			status: "permanent",
			page,
			pageSize,
		},
	});
	const items = (result.records ?? []).map((r) => ({
		id: r.id,
		url: `/file/r/${r.id}`,
		name: r.originalName,
		size: r.size,
		fileType: r.mimeType,
	}));
	return { items, total: result.total };
};

/** 编辑器媒体能力：图片/视频/音频/附件统一走后台上传，媒体库取自文件库 */
const MEDIA: RichEditorMedia = {
	uploadImage: uploadMedia,
	uploadVideo: uploadMedia,
	uploadAudio: uploadMedia,
	uploadAttachment: uploadMedia,
	getList: getMediaList,
};

export function RichEditor({ value = "", onChange }: RichEditorProps) {
	return <RichEditorBase value={value} onChange={onChange} media={MEDIA} />;
}
