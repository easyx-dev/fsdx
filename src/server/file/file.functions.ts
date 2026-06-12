/**
 * 文件管理：Server Function 包装器
 */
import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import dayjs from "dayjs";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/index";
import { file } from "#/db/schema";
import { logger } from "#/lib/logger/logger";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { storage } from "#/lib/storage/storage";
import { adminPermGuard } from "#/middleware/admin-auth";
import { logOperation } from "#/server/operation-log/operation-log.server";
import { getFileList, sha256, TEMP_EXPIRE_HOURS } from "./file.server";

/** 文件列表查询参数 schema */
export const fileListSchema = z.object({
	status: z.string().optional(),
	keyword: z.string().optional(),
	mimePrefix: z.string().optional(),
	sortField: z.string().optional(),
	sortOrder: z.enum(["ascend", "descend"]).optional(),
	page: z.number().optional(),
	pageSize: z.number().optional(),
});

/** 获取文件列表（分页、筛选、搜索、排序） */
export const getFileListSFn = createServerFn({ method: "GET" })
	.middleware([adminPermGuard(PERMISSIONS.FILE_VIEW)])
	.inputValidator(fileListSchema)
	.handler(async ({ data }) => {
		return getFileList(data);
	});

/** 上传文件（支持 SHA256 秒传） */
export const uploadFileSFn = createServerFn({ method: "POST" })
	.middleware([adminPermGuard(PERMISSIONS.FILE_UPLOAD)])
	.inputValidator((data: unknown) => {
		if (!(data instanceof FormData)) throw new Error("Expected FormData");
		const f = data.get("file");
		if (!f || !(f instanceof File)) throw new Error("未选择文件");
		const permanent = data.get("permanent") === "true";
		return { file: f, permanent };
	})
	.handler(async ({ data: { file: fileField, permanent }, context }) => {
		const buffer = Buffer.from(await fileField.arrayBuffer());
		const hash = sha256(buffer);
		const originalName = fileField.name;
		const mimeType = fileField.type || "application/octet-stream";

		const existing = await db.query.file.findFirst({
			where: and(
				eq(file.sha256, hash),
				eq(file.status, "permanent"),
				isNull(file.deletedAt),
			),
		});

		if (existing) {
			// 秒传：记录操作日志
			logOperation({
				operatorId: context.user.id,
				operatorName: context.user.username,
				module: "file",
				action: "upload",
				targetType: "file",
				targetId: existing.id,
				targetName: existing.originalName,
				detail: { isDuplicated: true },
			});

			return {
				success: true,
				data: {
					id: existing.id,
					originalName: existing.originalName,
					size: existing.size,
					isDuplicated: true,
				},
			};
		}

		const ext = originalName.includes(".")
			? originalName.slice(originalName.lastIndexOf("."))
			: "";
		const date = dayjs().format("YYYY-MM-DD");
		const storedName = `${randomUUID()}${ext}`;
		const path = `${date}/${storedName}`;

		await storage.save(path, buffer);

		const status = permanent ? ("permanent" as const) : ("temp" as const);
		const expiredAt = permanent
			? null
			: new Date(Date.now() + TEMP_EXPIRE_HOURS * 3600 * 1000);
		const [record] = await db
			.insert(file)
			.values({
				sha256: hash,
				originalName,
				storedName,
				mimeType,
				size: buffer.length,
				path,
				status,
				expiredAt,
			})
			.returning();

		logger.info({ id: record.id, name: originalName }, "文件上传成功");

		logOperation({
			operatorId: context.user.id,
			operatorName: context.user.username,
			module: "file",
			action: "upload",
			targetType: "file",
			targetId: record.id,
			targetName: originalName,
		});

		return {
			success: true,
			data: {
				id: record.id,
				originalName,
				size: buffer.length,
				isDuplicated: false,
			},
		};
	});
