/**
 * 资源管理器服务层测试
 * 核心测试：路径安全校验、写保护检查、目录操作
 */
import { mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

// mock getConfig
const { mockGetConfig } = vi.hoisted(() => ({
	mockGetConfig: vi.fn(),
}));

vi.mock("#/services/config/config.server", () => ({
	getConfig: mockGetConfig,
}));

import {
	buildBreadcrumb,
	isPathSafe,
	isWriteProtected,
	listDirectory,
} from "#/services/file-explorer/file-explorer.server";

/** 为每个 describe 创建独立的临时存储目录 */
function createTestStorageDir(label: string): string {
	return join(tmpdir(), `fe-test-${label}-${Date.now()}`);
}

describe("isPathSafe", () => {
	let testDir: string;
	let canonicalDir: string;

	beforeAll(async () => {
		testDir = createTestStorageDir("isPathSafe");
		process.env.STORAGE_DIR = testDir;
		await mkdir(testDir, { recursive: true });
		canonicalDir = await realpath(testDir);
		await mkdir(join(testDir, "subdir"), { recursive: true });
		await writeFile(join(testDir, "test.txt"), "hello");
		await writeFile(join(testDir, "subdir/nested.txt"), "nested");
	});

	afterAll(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	it("正常子路径应在存储目录范围内", async () => {
		const result = await isPathSafe("subdir");
		expect(result).toBe(join(canonicalDir, "subdir"));
	});

	it("空路径返回存储目录本身", async () => {
		const result = await isPathSafe("");
		expect(result).toBe(canonicalDir);
	});

	it("带多层目录的子路径", async () => {
		const result = await isPathSafe("subdir/nested.txt");
		expect(result).toBe(join(canonicalDir, "subdir/nested.txt"));
	});

	it(".. 路径逃逸应被拒绝", async () => {
		await expect(isPathSafe("../../../etc/passwd")).rejects.toThrow(
			"禁止访问存储目录之外的文件",
		);
	});

	it("/ 绝对路径逃逸应被拒绝", async () => {
		await expect(isPathSafe("/etc/passwd")).rejects.toThrow(
			"禁止访问存储目录之外的文件",
		);
	});
});

describe("isWriteProtected", () => {
	let testDir: string;
	let canonicalDir: string;

	beforeAll(async () => {
		testDir = createTestStorageDir("isWriteProtected");
		process.env.STORAGE_DIR = testDir;
		await mkdir(testDir, { recursive: true });
		await mkdir(join(testDir, "logs"), { recursive: true });
		await mkdir(join(testDir, "logs/2024"), { recursive: true });
		await mkdir(join(testDir, "uploads"), { recursive: true });
		await mkdir(join(testDir, "data"), { recursive: true });
		canonicalDir = await realpath(testDir);
	});

	afterAll(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("STORAGE_DIR 根目录始终写保护", async () => {
		mockGetConfig.mockResolvedValue("");
		const result = await isWriteProtected(canonicalDir);
		expect(result).toBe(true);
	});

	it("logs 目录匹配写保护列表", async () => {
		mockGetConfig.mockResolvedValue(JSON.stringify(["logs"]));
		const result = await isWriteProtected(join(canonicalDir, "logs"));
		expect(result).toBe(true);
	});

	it("logs 子目录也受保护", async () => {
		mockGetConfig.mockResolvedValue(JSON.stringify(["logs"]));
		const result = await isWriteProtected(join(canonicalDir, "logs/2024"));
		expect(result).toBe(true);
	});

	it("非保护目录不受限制", async () => {
		mockGetConfig.mockResolvedValue(JSON.stringify(["logs"]));
		const result = await isWriteProtected(join(canonicalDir, "data"));
		expect(result).toBe(false);
	});

	it("空配置时非根目录不受保护", async () => {
		mockGetConfig.mockResolvedValue("");
		const result = await isWriteProtected(join(canonicalDir, "data"));
		expect(result).toBe(false);
	});
});

describe("listDirectory", () => {
	let testDir: string;

	beforeAll(async () => {
		testDir = createTestStorageDir("listDirectory");
		process.env.STORAGE_DIR = testDir;
		await mkdir(testDir, { recursive: true });
		await mkdir(join(testDir, "dir-a"), { recursive: true });
		await mkdir(join(testDir, "dir-b"), { recursive: true });
		await writeFile(join(testDir, "file-1.txt"), "content1");
		await writeFile(join(testDir, "file-2.txt"), "content22");
	});

	afterAll(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	it("列出根目录内容，目录优先排序", async () => {
		const result = await listDirectory("");
		expect(result.total).toBe(4);
		expect(result.entries[0].type).toBe("directory");
		expect(result.entries[1].type).toBe("directory");
		expect(result.entries[2].type).toBe("file");
		expect(result.entries[3].type).toBe("file");
	});

	it("文件条目包含正确的 size", async () => {
		const result = await listDirectory("");
		const file1 = result.entries.find((e) => e.name === "file-1.txt");
		expect(file1).toBeDefined();
		expect(file1!.size).toBe(8);
		expect(file1!.type).toBe("file");
	});
});

describe("buildBreadcrumb", () => {
	it("空路径只有 root", async () => {
		const result = await buildBreadcrumb("");
		expect(result).toEqual([{ label: "root", path: "" }]);
	});

	it("单层路径", async () => {
		const result = await buildBreadcrumb("logs");
		expect(result).toEqual([
			{ label: "root", path: "" },
			{ label: "logs", path: "logs" },
		]);
	});

	it("多层路径", async () => {
		const result = await buildBreadcrumb("uploads/2024/01");
		expect(result).toEqual([
			{ label: "root", path: "" },
			{ label: "uploads", path: "uploads" },
			{ label: "2024", path: "uploads/2024" },
			{ label: "01", path: "uploads/2024/01" },
		]);
	});
});
