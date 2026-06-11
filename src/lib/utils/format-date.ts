/**
 * 统一的日期格式化工具函数
 * 基于 dayjs 实现，管理端 YYYY-MM-DD HH:mm，前台本地化格式
 */
import dayjs from "dayjs";

/** 格式化日期为本地化字符串（前台用，如 2026年6月11日 / June 11, 2026） */
export function formatDate(
	date: string | number | Date,
	locale: string,
): string {
	const fmt = locale.startsWith("zh") ? "YYYY年M月D日" : "MMMM D, YYYY";
	return dayjs(date).format(fmt);
}

/** 格式化日期时间为 YYYY-MM-DD HH:mm（管理端用） */
export function formatDateTime(
	date: string | number | Date,
	_locale: string,
): string {
	return dayjs(date).format("YYYY-MM-DD HH:mm");
}
