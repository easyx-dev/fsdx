/**
 * 日志读取模块：管理端查询和搜索日志文件
 */
import { createReadStream, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { logger } from "#/lib/logger/logger";

/** 日志目录路径 */
function getLogDir(): string {
	return resolve(process.env.STORAGE_DIR || ".tmp", "logs");
}

/** 日志条目 */
export interface LogEntry {
	timestamp: string;
	level: string;
	message: string;
	[key: string]: unknown;
}

/** 日志查询参数 */
export interface LogQuery {
	/** 开始日期 (YYYY-MM-DD) */
	startDate?: string;
	/** 结束日期 (YYYY-MM-DD) */
	endDate?: string;
	/** 关键词搜索 */
	keyword?: string;
	/** 日志级别筛选 */
	level?: string;
	/** 页码（从 1 开始） */
	page?: number;
	/** 每页条数 */
	pageSize?: number;
}

/** 日志查询结果 */
export interface LogQueryResult {
	entries: LogEntry[];
	total: number;
	page: number;
	pageSize: number;
}

/**
 * 获取日志文件列表，按日期倒序
 */
function getLogFiles(): string[] {
	if (!existsSync(getLogDir())) return [];
	return readdirSync(getLogDir())
		.filter((f) => f.endsWith(".log"))
		.sort()
		.reverse();
}

/**
 * 检查日志文件是否在指定日期范围内
 */
function isFileInDateRange(
	filename: string,
	startDate?: string,
	endDate?: string,
): boolean {
	const dateStr = filename.replace(".log", "");
	if (startDate && dateStr < startDate) return false;
	if (endDate && dateStr > endDate) return false;
	return true;
}

/**
 * 逐行读取日志文件内容
 */
async function readLogLines(filePath: string): Promise<string[]> {
	const lines: string[] = [];
	const stream = createReadStream(filePath, { encoding: "utf-8" });
	const rl = createInterface({
		input: stream,
		crlfDelay: Number.POSITIVE_INFINITY,
	});
	for await (const line of rl) {
		if (line.trim()) lines.push(line);
	}
	return lines;
}

/**
 * 解析 pino JSON 日志行
 */
function parseLogLine(line: string): LogEntry | null {
	try {
		return JSON.parse(line) as LogEntry;
	} catch {
		// 非 JSON 行（如 pino 写入不完整），跳过
		return null;
	}
}

/**
 * 查询日志文件
 */
export async function queryLogs(query: LogQuery = {}): Promise<LogQueryResult> {
	const { startDate, endDate, keyword, level, page = 1, pageSize = 20 } = query;

	const logFiles = getLogFiles().filter((f) =>
		isFileInDateRange(f, startDate, endDate),
	);

	const allEntries: LogEntry[] = [];

	for (const file of logFiles) {
		const lines = await readLogLines(resolve(getLogDir(), file));
		for (const line of lines) {
			let entry = parseLogLine(line);
			if (!entry) {
				entry = {
					level: "error",
					timestamp: "解析失败",
					message: line,
				} as LogEntry;
			}
			if (level && entry.level !== level) continue;
			if (
				keyword &&
				!JSON.stringify(entry).toLowerCase().includes(keyword.toLowerCase())
			) {
				continue;
			}
			allEntries.push(entry);
		}
	}

	// 按时间倒序
	allEntries.sort((a, b) => {
		const ta = a.time ?? a.timestamp ?? "";
		const tb = b.time ?? b.timestamp ?? "";
		return String(tb).localeCompare(String(ta));
	});

	const total = allEntries.length;
	const start = (page - 1) * pageSize;
	const entries = allEntries.slice(start, start + pageSize);

	return { entries, total, page, pageSize };
}

/**
 * 读取指定日期的日志文件完整内容
 */
export async function readLogFileContent(date: string): Promise<string | null> {
	const logPath = resolve(getLogDir(), `${date}.log`);
	if (!existsSync(logPath)) return null;
	try {
		const lines = await readLogLines(logPath);
		return lines.join("\n");
	} catch (err) {
		logger.error({ err, date }, "[log-reader] 读取日志文件失败");
		return null;
	}
}

/**
 * 获取可用的日志日期列表
 */
export function getLogDates(): string[] {
	return getLogFiles().map((f) => f.replace(".log", ""));
}
