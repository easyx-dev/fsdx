/**
 * 文件管理：Server Function 包装器
 */
import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "#/db/index";
import { file } from "#/db/schema";
import { logger } from "#/lib/logger/logger";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { storage } from "#/lib/storage/storage";
import { permGuard } from "#/middleware/server-fn-auth";
import { sha256, TEMP_EXPIRE_HOURS } from "./file.server";

/** 上传文件（支持 SHA256 秒传） */
export const uploadFile = createServerFn({ method: "POST" })
	.middleware([permGuard(PERMISSIONS.FILE_UPLOAD)])
	.inputValidator((data: unknown) => {
		if (!(data instanceof FormData)) throw new Error("Expected FormData");
		const f = data.get("file");
		if (!f || !(f instanceof File)) throw new Error("未选择文件");
		return f;
	})
	.handler(async ({ data: fileField }) => {
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
		const date = new Date().toISOString().slice(0, 10);
		const storedName = `${randomUUID()}${ext}`;
		const path = `${date}/${storedName}`;

		await storage.save(path, buffer);

		const expiredAt = new Date(Date.now() + TEMP_EXPIRE_HOURS * 3600 * 1000);
		const [record] = await db
			.insert(file)
			.values({
				sha256: hash,
				originalName,
				storedName,
				mimeType,
				size: buffer.length,
				path,
				status: "temp",
				expiredAt,
			})
			.returning();

		logger.info({ id: record.id, name: originalName }, "文件上传成功");
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
