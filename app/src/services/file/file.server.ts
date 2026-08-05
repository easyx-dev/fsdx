/**
 * 文件管理：服务端辅助函数（上传逻辑、存储、清理、列表、删除）
 */
import { createHash, randomUUID } from "node:crypto";
import { storage } from "@fsdx/core/storage";
import dayjs from "dayjs";
import { and, eq, ilike, lt } from "drizzle-orm";
import { db } from "#/db/index";
import { file } from "#/db/schema";
import { logger } from "#/lib/logger/logger";
import {
	buildSortClause,
	executePaginatedQuery,
	notDeleted,
	paginationOffset,
} from "#/services/query/query-utils.server";
import type { PaginatedResult, PaginatedSortParams } from "#/types/query";

export type FileRecord = typeof file.$inferSelect;

export const TEMP_EXPIRE_HOURS = 168;

/** 计算 SHA256 哈希（供上传秒传检测使用） */
export function sha256(buf: Buffer): string {
	return createHash("sha256").update(buf).digest("hex");
}

/** 读取文件内容（供下载路由使用） */
export async function readFileContent(id: string) {
	const record = await db.query.file.findFirst({
		where: and(eq(file.id, id), notDeleted(file.deletedAt)),
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
				notDeleted(file.deletedAt),
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
				notDeleted(file.deletedAt),
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

/** 获取文件列表（支持分页、筛选、关键词搜索、排序） */
export async function getFileList(
	params?: PaginatedSortParams & {
		status?: string;
		keyword?: string;
		mimePrefix?: string;
	},
): Promise<PaginatedResult<FileRecord>> {
	const {
		status,
		keyword,
		mimePrefix,
		sortField,
		sortOrder = "descend",
		page = 1,
		pageSize = 20,
	} = params ?? {};
	const cappedPageSize = Math.min(pageSize, 100);
	const conditions = [notDeleted(file.deletedAt)];
	if (status) conditions.push(eq(file.status, status));
	if (keyword) conditions.push(ilike(file.originalName, `%${keyword}%`));

	if (mimePrefix) conditions.push(ilike(file.mimeType, `${mimePrefix}%`));

	const sortOrderClause = buildSortClause(
		{ size: file.size, createdAt: file.createdAt },
		sortField,
		sortOrder,
		"createdAt",
	);

	const offset = paginationOffset(page, cappedPageSize);

	return executePaginatedQuery(
		db
			.select()
			.from(file)
			.where(and(...conditions))
			.orderBy(sortOrderClause)
			.limit(cappedPageSize)
			.offset(offset),
		db.$count(
			db
				.select()
				.from(file)
				.where(and(...conditions)),
		),
		page,
		cappedPageSize,
	);
}

/** 删除文件（软删除） */
export async function deleteFile(id: string): Promise<boolean> {
	const existing = await db.query.file.findFirst({
		where: and(eq(file.id, id), notDeleted(file.deletedAt)),
	});
	if (!existing) return false;

	await db.update(file).set({ deletedAt: new Date() }).where(eq(file.id, id));

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

/**
 * 上传文件：SHA256 秒传检测 + 存储落盘 + 入库
 * 返回记录及是否命中秒传
 */
export async function uploadFile(
	buffer: Buffer,
	originalName: string,
	mimeType: string,
	permanent: boolean,
): Promise<{ record: FileRecord; isDuplicated: boolean }> {
	const hash = sha256(buffer);

	const existing = await db.query.file.findFirst({
		where: and(
			eq(file.sha256, hash),
			eq(file.status, "permanent"),
			notDeleted(file.deletedAt),
		),
	});

	if (existing) {
		return { record: existing, isDuplicated: true };
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
	return { record, isDuplicated: false };
}

/** 查询文件原始文件名（供预览组件使用），不存在返回 null */
export async function getFileInfo(id: string): Promise<string | null> {
	const result = await db.query.file.findFirst({
		where: and(eq(file.id, id), notDeleted(file.deletedAt)),
		columns: { originalName: true },
	});
	return result?.originalName ?? null;
}
