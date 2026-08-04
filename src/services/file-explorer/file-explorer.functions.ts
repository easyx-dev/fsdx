/**
 * 资源管理器：Server Function 包装器
 */
import { createServerFn } from "@tanstack/react-start";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { adminPermGuard } from "#/middleware/admin-auth";
import { logCrud } from "#/services/operation-log/operation-log.server";
import {
	renameSchema,
	subPathAndNameSchema,
	subPathSchema,
} from "./file-explorer.schemas";
import {
	createDirectory,
	deleteEntry,
	getDirectoryInfo,
	getTextContent,
	renameEntry,
	saveUploadedFile,
} from "./file-explorer.server";

/** 获取目录全量信息（内容 + 面包屑 + 写保护状态） */
export const listDirectorySFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.FILE_EXPLORER_VIEW)])
	.inputValidator(subPathSchema)
	.handler(async ({ data }) => {
		return getDirectoryInfo(data.subPath);
	});

/** 获取文本文件内容 */
export const getTextContentSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.FILE_EXPLORER_VIEW)])
	.inputValidator(subPathSchema)
	.handler(async ({ data }) => {
		return getTextContent(data.subPath);
	});

/** 创建子目录 */
export const createDirectorySFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.FILE_EXPLORER_MKDIR)])
	.inputValidator(subPathAndNameSchema)
	.handler(async ({ data, context }) => {
		await createDirectory(data.subPath, data.name);
		logCrud(context.user, "file_explorer", "mkdir", {
			id: `${data.subPath ? `${data.subPath}/` : ""}${data.name}`,
			name: data.name,
		});
		return { success: true };
	});

/** 重命名文件或目录 */
export const renameEntrySFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.FILE_EXPLORER_RENAME)])
	.inputValidator(renameSchema)
	.handler(async ({ data, context }) => {
		const result = await renameEntry(data.subPath, data.newName);
		logCrud(context.user, "file_explorer", "rename", {
			id: data.subPath,
			name: result.oldName,
		});
		return { success: true };
	});

/** 删除文件或空目录 */
export const deleteEntrySFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.FILE_EXPLORER_DELETE)])
	.inputValidator(subPathSchema)
	.handler(async ({ data, context }) => {
		const result = await deleteEntry(data.subPath);
		logCrud(context.user, "file_explorer", "delete", {
			id: data.subPath,
			name: result.deletedName,
		});
		return { success: true };
	});

/** 上传文件到当前目录 */
export const uploadFileSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.FILE_EXPLORER_UPLOAD)])
	.inputValidator((data: unknown) => {
		if (!(data instanceof FormData)) throw new Error("Expected FormData");
		const f = data.get("file");
		if (!f || !(f instanceof File)) throw new Error("未选择文件");
		const subPath = (data.get("subPath") as string) ?? "";
		return { file: f, subPath };
	})
	.handler(async ({ data: { file: fileField, subPath }, context }) => {
		const buffer = Buffer.from(await fileField.arrayBuffer());
		await saveUploadedFile(subPath, fileField.name, buffer);
		logCrud(context.user, "file_explorer", "upload", {
			id: subPath,
			name: fileField.name,
		});
		return { success: true };
	});
