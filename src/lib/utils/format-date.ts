/**
 * 统一的日期格式化工具函数
 * 替换项目中散落的 toLocaleDateString / toLocaleString 调用
 */

/**
 * 格式化日期为本地化字符串
 * @param date 日期值
 * @param locale 语言区域（如 "zh-CN"、"en"）
 * @param options Intl.DateTimeFormatOptions
 */
export function formatDate(
	date: string | number | Date,
	locale: string,
	options?: Intl.DateTimeFormatOptions,
): string {
	const d = date instanceof Date ? date : new Date(date);
	return d.toLocaleDateString(locale, options);
}

/**
 * 格式化日期时间为本地化字符串（含时间）
 * @param date 日期值
 * @param locale 语言区域
 */
export function formatDateTime(
	date: string | number | Date,
	locale: string,
): string {
	const d = date instanceof Date ? date : new Date(date);
	return d.toLocaleString(locale);
}
