/**
 * 文件管理：服务端辅助函数（上传逻辑、存储、清理、列表、删除）
 */
import { createHash } from "node:crypto";
import { and, asc, desc, eq, ilike, isNull, lt, type SQL } from "drizzle-orm";
import { db } from "#/db/index";
import { file } from "#/db/schema";
import { logger } from "#/lib/logger/logger";
import { storage } from "#/lib/storage/storage";

export type FileRecord = typeof file.$inferSelect;

export const TEMP_EXPIRE_HOURS = 24;

/** 计算 SHA256 哈希（供上传秒传检测使用） */
export function sha256(buf: Buffer): string {
	return createHash("sha256").update(buf).digest("hex");
}

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

/** 获取文件列表（支持筛选、关键词搜索、排序） */
export async function getFileList(params?: {
	status?: string;
	keyword?: string;
	sortField?: string;
	sortOrder?: string;
}) {
	const { status, keyword, sortField, sortOrder = "descend" } = params ?? {};
	const conditions: SQL[] = [isNull(file.deletedAt)];
	if (status) conditions.push(eq(file.status, status));
	if (keyword) conditions.push(ilike(file.originalName, `%${keyword}%`));

	const sortColumn = sortField === "size" ? file.size : file.createdAt;
	const direction = sortOrder === "ascend" ? asc(sortColumn) : desc(sortColumn);

	return db
		.select()
		.from(file)
		.where(and(...conditions))
		.orderBy(direction)
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
