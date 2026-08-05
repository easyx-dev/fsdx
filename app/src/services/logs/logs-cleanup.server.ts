/**
 * 日志文件清理：删除超过保留期的日志文件
 */
import { existsSync, readdirSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";

/** 将 Date 格式化为 YYYY-MM-DD 字符串 */
function formatDate(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

/** 日志文件名日期格式 */
const LOG_DATE_RE = /^\d{4}-\d{2}-\d{2}\.log$/;

/**
 * 清理超过保留期的日志文件
 * @param retentionDays 日志保留天数，默认 30 天
 * @returns 删除的文件数量
 */
export function cleanExpiredLogs(retentionDays = 30): number {
	const logDir = resolve(process.env.STORAGE_DIR || ".tmp", "logs");
	if (!existsSync(logDir)) return 0;

	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - retentionDays);
	const cutoffStr = formatDate(cutoff);

	const files = readdirSync(logDir).filter((f) => LOG_DATE_RE.test(f));
	let deleted = 0;
	for (const f of files) {
		const dateStr = f.replace(".log", "");
		if (dateStr < cutoffStr) {
			try {
				unlinkSync(join(logDir, f));
				deleted++;
			} catch {
				console.warn(`清理日志文件 ${f} 失败`);
			}
		}
	}
	return deleted;
}
