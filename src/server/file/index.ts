/**
 * 文件管理：上传（SHA256 秒传）、临时/永久、清理、列表、删除
 */
import { createHash, randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { db } from "#/db/index";
import { file } from "#/db/schema";
import { logger } from "#/lib/logger/logger";
import { PERMISSIONS } from "#/lib/permissions/permissions";
import { storage } from "#/lib/storage/storage";
import { permGuard } from "#/middleware/server-fn-auth";

export type FileRecord = typeof file.$inferSelect;

const TEMP_EXPIRE_HOURS = 24;

function sha256(buf: Buffer): string {
	return createHash("sha256").update(buf).digest("hex");
}

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

/** 读取文件内容（供下载路由使用） */
export async function readFileContent(id: string) {
	const record = await db.query.file.findFirst({
		where: and(eq(file.id, id), isNull(file.deletedAt)),
	});
	if (!record) return null;
	const buffer = await storage.read(record.path);
	return { buffer, record };
}

/** 清理过期临时文件 */
export async function cleanExpiredFiles(): Promise<number> {
	const expiredFiles = await db
		.select()
		.from(file)
		.where(
			and(
				eq(file.status, "temp"),
				lt(file.expiredAt, new Date()),
				isNull(file.deletedAt),
			),
		);

	if (expiredFiles.length === 0) return 0;

	await db
		.update(file)
		.set({ deletedAt: new Date() })
		.where(
			and(
				eq(file.status, "temp"),
				lt(file.expiredAt, new Date()),
				isNull(file.deletedAt),
			),
		);

	for (const f of expiredFiles) {
		storage.delete(f.path).catch((err) => {
			logger.error(
				{ path: f.path, error: (err as Error).message },
				"清理物理文件失败",
			);
		});
	}

	logger.info({ count: expiredFiles.length }, "过期临时文件已清理");
	return expiredFiles.length;
}

/** 获取文件列表 */
export async function getFileList(status?: string) {
	const conditions = [isNull(file.deletedAt)];
	if (status) conditions.push(eq(file.status, status));
	return db
		.select()
		.from(file)
		.where(and(...conditions))
		.orderBy(desc(file.createdAt))
		.limit(100);
}

/** 删除文件（软删除） */
export async function deleteFile(id: string): Promise<boolean> {
	const existing = await db.query.file.findFirst({
		where: and(eq(file.id, id), isNull(file.deletedAt)),
	});
	if (!existing) return false;

	await db.update(file).set({ deletedAt: new Date() }).where(eq(file.id, id));

	logger.info({ id, name: existing.originalName }, "文件已删除");
	return true;
}

/** 将临时文件转为永久存储 */
export async function makePermanent(id: string): Promise<boolean> {
	await db
		.update(file)
		.set({ status: "permanent", expiredAt: null, updatedAt: new Date() })
		.where(eq(file.id, id));

	return true;
}
