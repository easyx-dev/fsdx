/**
 * 项目级常量：日志级别颜色、预置字典定义、编辑器类型等
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

/** 预置字典条目类型 */
export interface PresetDictItem {
	label: string;
	value: string;
	sortOrder: number;
	color?: string;
	extraType?: string;
	extra?: string;
}

/** 预置字典常量（slug 和条目 value 不可修改、不可删除） */
export const PRESET_DICTS: {
	slug: string;
	name: string;
	items: PresetDictItem[];
}[] = [
	{
		slug: "user_status",
		name: "用户状态",
		items: [
			{ label: "正常", value: "active", sortOrder: 0, color: "green" },
			{ label: "禁用", value: "disabled", sortOrder: 1, color: "red" },
		],
	},
	{
		slug: "news_status",
		name: "新闻状态",
		items: [
			{ label: "草稿", value: "draft", sortOrder: 0, color: "gold" },
			{ label: "已发布", value: "published", sortOrder: 1, color: "green" },
			{ label: "已归档", value: "archived", sortOrder: 2, color: "default" },
		],
	},
];
