/**
 * 管理端共享常量：日志级别颜色、新闻状态标签等散落在各页面的常量集中管理
 */

/** 日志级别对应 Tag 颜色 */
export const LEVEL_COLORS: Record<string, string> = {
	info: "blue",
	warn: "gold",
	error: "red",
	debug: "default",
	fatal: "red",
};

/** 日志级别选项 */
export const LEVEL_OPTIONS = [
	{ label: "全部", value: "" },
	{ label: "INFO", value: "info" },
	{ label: "WARN", value: "warn" },
	{ label: "ERROR", value: "error" },
	{ label: "DEBUG", value: "debug" },
	{ label: "FATAL", value: "fatal" },
];

/** 新闻状态对应 Tag 颜色 */
export const NEWS_STATUS_COLORS: Record<string, string> = {
	draft: "gold",
	published: "green",
	archived: "default",
};

/** 新闻状态标签 */
export const NEWS_STATUS_LABELS: Record<string, string> = {
	draft: "草稿",
	published: "已发布",
	archived: "已归档",
};
