/**
 * 文件上传组件（app 业务壳）
 * 基础组件在 @fsdx/ui-spa/upload，此处注入项目统一的上传与文件库查询实现
 * value / onChange 兼容 antd Form.Item 直接注入
 */
import {
	type FetchFiles,
	FileUpload as FileUploadBase,
	type UploadFileFn,
} from "@fsdx/ui-spa/upload";
import { getFileListSFn, uploadFileSFn } from "#/services/file/file.functions";

interface FileUploadProps {
	/** 文件 ID（单文件）或文件 ID 数组（多文件），兼容 Form.Item 注入 */
	value?: string | string[];
	/** 值变更回调，兼容 Form.Item 注入 */
	onChange?: (value: string | string[]) => void;
	/** 最大上传数量，默认 1 */
	maxCount?: number;
	/** 是否禁用 */
	disabled?: boolean;
	/** 接受的文件类型，不传允许所有类型 */
	accept?: string;
	/** 上传模式：drag 为拖拽区，button 为按钮点击 */
	type?: "drag" | "button";
	/** 上传列表样式：text（文件列表）、picture（缩略图列表） */
	listType?: "text" | "picture";
	/** 上传为永久文件，默认 true；设为 false 则为临时文件（7 天后过期） */
	permanent?: boolean;
}

/** 上传文件到文件库，返回入库文件信息 */
const uploadFile: UploadFileFn = async (file, permanent) => {
	const fd = new FormData();
	fd.append("file", file);
	if (permanent) fd.append("permanent", "true");
	const result = await uploadFileSFn({ data: fd });
	if (!result.success || !result.data) {
		throw new Error("上传失败");
	}
	return result.data;
};

/** 查询文件库列表（服务端分页） */
const fetchFiles: FetchFiles = async ({
	keyword,
	mimePrefix,
	page,
	pageSize,
}) => {
	const result = await getFileListSFn({
		data: { keyword, mimePrefix, page, pageSize },
	});
	return { records: result.records ?? [], total: result.total };
};

/** 生成文件读取地址（内联预览/打开） */
const readUrl = (id: string) => `/file/r/${id}`;

export function FileUpload(props: FileUploadProps) {
	return (
		<FileUploadBase
			{...props}
			uploadFile={uploadFile}
			fetchFiles={fetchFiles}
			readUrl={readUrl}
		/>
	);
}
