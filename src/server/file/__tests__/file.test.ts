/**
 * 文件管理测试：SHA256 + 读取 + 清理 + 列表 + 删除 + 转永久
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#/lib/logger/logger", () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

const { mockStorage } = vi.hoisted(() => ({
	mockStorage: {
		read: vi.fn(),
		delete: vi.fn(),
		save: vi.fn(),
		getUrl: vi.fn(),
		exists: vi.fn(),
	},
}));
vi.mock("#/lib/storage/storage", () => ({ storage: mockStorage }));

const { mockDb } = vi.hoisted(() => {
	const q = () => ({ findFirst: vi.fn(), findMany: vi.fn() });
	return {
		mockDb: {
			query: {
				file: q(),
				adminUser: q(),
				clientUser: q(),
				role: q(),
				news: q(),
				dict: q(),
				dictItem: q(),
				systemConfig: q(),
				captchaCode: q(),
			},
			$count: vi.fn(),
			select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn() })) })),
			insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) })),
			update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
			delete: vi.fn(() => ({ where: vi.fn() })),
		},
	};
});
vi.mock("#/db", () => ({ db: mockDb }));

import {
	cleanExpiredFiles,
	deleteFile,
	getFileList,
	makePermanent,
	readFileContent,
	sha256,
	TEMP_EXPIRE_HOURS,
} from "#/server/file/file.server";

const fileRecord = {
	id: "f-1",
	sha256: "abc123",
	originalName: "测试.txt",
	storedName: "uuid.txt",
	mimeType: "text/plain",
	size: 1024,
	path: "2024-01-01/uuid.txt",
	status: "temp" as const,
	expiredAt: null as Date | null,
	createdAt: new Date(),
	updatedAt: new Date(),
	deletedAt: null as Date | null,
	createdBy: null,
};

describe("sha256", () => {
	it("对已知输入产生预期哈希值", () => {
		const hash = sha256(Buffer.from("hello"));
		expect(hash).toBe(
			"2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
		);
	});

	it("不同输入产生不同哈希值", () => {
		const hash1 = sha256(Buffer.from("hello"));
		const hash2 = sha256(Buffer.from("world"));
		expect(hash1).not.toBe(hash2);
	});
});

describe("readFileContent", () => {
	beforeEach(() => vi.clearAllMocks());

	it("文件存在时返回 buffer 和 record", async () => {
		const content = Buffer.from("文件内容");
		mockDb.query.file.findFirst.mockResolvedValue(fileRecord);
		mockStorage.read.mockResolvedValue(content);

		const result = await readFileContent("f-1");
		expect(result).not.toBeNull();
		expect(result!.buffer).toEqual(content);
		expect(result!.record.id).toBe("f-1");
		expect(mockStorage.read).toHaveBeenCalledWith(fileRecord.path);
	});

	it("文件不存在时返回 null", async () => {
		mockDb.query.file.findFirst.mockResolvedValue(undefined);

		const result = await readFileContent("不存在");
		expect(result).toBeNull();
	});
});

describe("cleanExpiredFiles", () => {
	beforeEach(() => vi.clearAllMocks());

	it("无过期文件时返回 0", async () => {
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({ where: vi.fn().mockResolvedValue([]) })),
		});

		const result = await cleanExpiredFiles();
		expect(result).toBe(0);
	});

	it("有过期文件时返回数量并调用 storage.delete", async () => {
		const expired = [
			{ ...fileRecord, id: "f-1", path: "path1.txt" },
			{ ...fileRecord, id: "f-2", path: "path2.txt" },
		];
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({ where: vi.fn().mockResolvedValue(expired) })),
		});
		mockStorage.delete.mockResolvedValue(undefined);

		const result = await cleanExpiredFiles();
		expect(result).toBe(2);
		expect(mockDb.update).toHaveBeenCalled();
		expect(mockStorage.delete).toHaveBeenCalledTimes(2);
		expect(mockStorage.delete).toHaveBeenCalledWith("path1.txt");
		expect(mockStorage.delete).toHaveBeenCalledWith("path2.txt");
	});

	it("storage.delete 报错时被捕获不中断流程", async () => {
		const expired = [{ ...fileRecord, id: "f-1", path: "bad.txt" }];
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({ where: vi.fn().mockResolvedValue(expired) })),
		});
		mockStorage.delete.mockRejectedValue(new Error("磁盘错误"));

		const result = await cleanExpiredFiles();
		expect(result).toBe(1);
	});
});

describe("getFileList", () => {
	beforeEach(() => vi.clearAllMocks());

	it("返回分页文件列表（空）", async () => {
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					orderBy: vi.fn(() => ({
						limit: vi.fn(() => ({
							offset: vi.fn().mockResolvedValue([]),
						})),
					})),
				})),
			})),
		});
		mockDb.$count.mockResolvedValue(0);

		const result = await getFileList();
		expect(result.records).toHaveLength(0);
		expect(result.total).toBe(0);
		expect(result.page).toBe(1);
		expect(result.pageSize).toBe(20);
	});

	it("按状态筛选文件列表", async () => {
		mockDb.select.mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					orderBy: vi.fn(() => ({
						limit: vi.fn(() => ({
							offset: vi.fn().mockResolvedValue([fileRecord]),
						})),
					})),
				})),
			})),
		});
		mockDb.$count.mockResolvedValue(1);

		const result = await getFileList({ status: "permanent" });
		expect(result.records).toHaveLength(1);
		expect(result.records[0].status).toBe("temp");
		expect(result.total).toBe(1);
	});
});

describe("deleteFile", () => {
	beforeEach(() => vi.clearAllMocks());

	it("不存在的文件返回 false", async () => {
		mockDb.query.file.findFirst.mockResolvedValue(undefined);

		const result = await deleteFile("不存在");
		expect(result).toBe(false);
	});

	it("已存在的文件删除成功返回 true", async () => {
		mockDb.query.file.findFirst.mockResolvedValue(fileRecord);

		const result = await deleteFile("f-1");
		expect(result).toBe(true);
		expect(mockDb.update).toHaveBeenCalled();
	});
});

describe("makePermanent", () => {
	it("将临时文件转为永久存储", async () => {
		const result = await makePermanent("f-1");
		expect(result).toBe(true);
		expect(mockDb.update).toHaveBeenCalled();
	});
});

describe("TEMP_EXPIRE_HOURS", () => {
	it("默认值为 168 小时（7 天）", () => {
		expect(TEMP_EXPIRE_HOURS).toBe(168);
	});
});
