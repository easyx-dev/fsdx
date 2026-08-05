/**
 * 日志查询：代理调用 lib/logger 的日志读取能力
 * 提供 SF 安全的可序列化类型包装
 */

import {
	type LogQuery,
	queryLogs,
	type LogEntry as RawLogEntry,
	getLogDates as readLogDates,
	readLogFileContent,
} from "./log-reader";

/** SF 安全的日志条目类型（无 index signature） */
export interface LogEntry {
	time?: number | string;
	level: string;
	msg?: string;
	timestamp?: string;
	message?: string;
}

/** SF 安全的日志查询结果 */
export interface LogQueryResult {
	entries: LogEntry[];
	total: number;
	page: number;
	pageSize: number;
}

/** pino 日志级别数字映射 */
const PINO_LEVEL_MAP: Record<number, string> = {
	10: "trace",
	20: "debug",
	30: "info",
	40: "warn",
	50: "error",
	60: "fatal",
};

/** 将 pino 数字级别转为字符串 */
function pinoLevelToString(level: unknown): string {
	if (typeof level === "number") return PINO_LEVEL_MAP[level] ?? String(level);
	if (typeof level === "string") return level;
	return "";
}

/**
 * 将原始日志条目转换为 SF 安全类型
 */
function toSerializable(entry: RawLogEntry): LogEntry {
	const raw = entry as Record<string, unknown>;
	// 提取 pino 标准字段，其余字段原样保留（如 err、stack、req 等）
	const rest = Object.fromEntries(
		Object.entries(raw).filter(
			([key]) =>
				!["time", "level", "msg", "timestamp", "message"].includes(key),
		),
	);
	return {
		time: raw.time as string | number | undefined,
		level: pinoLevelToString(raw.level),
		msg: raw.msg as string | undefined,
		timestamp: raw.timestamp as string | undefined,
		message: raw.message as string | undefined,
		...rest,
	};
}

/** 查询日志文件 */
export async function searchLogs(
	query: LogQuery = {},
): Promise<LogQueryResult> {
	const result = await queryLogs(query);
	return {
		...result,
		entries: result.entries.map(toSerializable),
	};
}

/** 获取指定日期的日志原始内容 */
export async function getLogRawContent(date: string): Promise<string | null> {
	return readLogFileContent(date);
}

/** 获取可用的日志日期列表 */
export async function getLogDates(): Promise<string[]> {
	return readLogDates();
}
