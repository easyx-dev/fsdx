/**
 * 日志查询：代理调用 lib/logger 的日志读取能力
 * 提供 SF 安全的可序列化类型包装
 */

import {
	type LogQuery,
	queryLogs,
	type LogEntry as RawLogEntry,
	getLogDates as readLogDates,
} from "#/lib/logger/log-reader";

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
	return {
		time: (entry as Record<string, unknown>).time as
			| string
			| number
			| undefined,
		// pino 日志级别为数字（30/40/50），需转为字符串
		level: pinoLevelToString((entry as Record<string, unknown>).level),
		msg: (entry as Record<string, unknown>).msg as string | undefined,
		timestamp: (entry as Record<string, unknown>).timestamp as
			| string
			| undefined,
		message: (entry as Record<string, unknown>).message as string | undefined,
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

/** 获取可用的日志日期列表 */
export async function getLogDates(): Promise<string[]> {
	return readLogDates();
}
