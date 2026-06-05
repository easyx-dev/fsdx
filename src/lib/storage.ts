/**
 * 文件存储抽象层：定义统一接口，本地存储实现，预留对象存储扩展
 */
import { createWriteStream, existsSync } from "node:fs";
import fs from "node:fs/promises";
import { resolve } from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { getEnv } from "#/lib/env";

/** 存储适配器接口 */
export interface StorageAdapter {
	/** 保存文件，返回存储后的文件路径 */
	save(filePath: string, content: Buffer | Readable): Promise<string>;
	/** 读取文件 */
	read(filePath: string): Promise<Buffer>;
	/** 删除文件 */
	delete(filePath: string): Promise<void>;
	/** 获取文件访问 URL */
	getUrl(filePath: string): string;
	/** 检查文件是否存在 */
	exists(filePath: string): Promise<boolean>;
}

/** 本地文件存储适配器实现 */
export class LocalStorageAdapter implements StorageAdapter {
	private baseDir: string;

	constructor(baseDir: string = resolve(getEnv().STORAGE_DIR, "uploads")) {
		this.baseDir = baseDir;
	}

	async save(filePath: string, content: Buffer | Readable): Promise<string> {
		const fullPath = resolve(this.baseDir, filePath);
		const dir = resolve(fullPath, "..");
		await fs.mkdir(dir, { recursive: true });

		if (Buffer.isBuffer(content)) {
			await fs.writeFile(fullPath, content);
		} else {
			const writeStream = createWriteStream(fullPath);
			await pipeline(content, writeStream);
		}

		return filePath;
	}

	async read(filePath: string): Promise<Buffer> {
		const fullPath = resolve(this.baseDir, filePath);
		return fs.readFile(fullPath);
	}

	async delete(filePath: string): Promise<void> {
		const fullPath = resolve(this.baseDir, filePath);
		if (existsSync(fullPath)) {
			await fs.unlink(fullPath);
		}
	}

	getUrl(filePath: string): string {
		return `/${getEnv().STORAGE_DIR}/uploads/${filePath}`;
	}

	async exists(filePath: string): Promise<boolean> {
		const fullPath = resolve(this.baseDir, filePath);
		return existsSync(fullPath);
	}
}

/** 默认存储适配器实例 */
export const storage: StorageAdapter = new LocalStorageAdapter();
