/**
 * 操作日志展示元数据：模块/动作的颜色与中文名映射，供明细页与分析页共用
 */

/** 模块对应 Tag 颜色 */
export const MODULE_COLORS: Record<string, string> = {
	news: "blue",
	admin: "purple",
	client: "cyan",
	"admin-role": "orange",
	dict: "green",
	config: "geekblue",
	file: "lime",
	"file-explorer": "lime",
	translation: "magenta",
};

/** 动作对应 Tag 颜色 */
export const ACTION_COLORS: Record<string, string> = {
	create: "green",
	update: "blue",
	delete: "red",
	change_status: "gold",
	reset_pwd: "orange",
	export: "cyan",
	import: "purple",
	upload: "geekblue",
	make_permanent: "lime",
	login: "cyan",
	request: "geekblue",
};

/** 模块中文名映射 */
export const MODULE_LABELS: Record<string, string> = {
	news: "新闻",
	admin: "管理员",
	client: "客户端用户",
	"admin-role": "角色",
	dict: "字典",
	config: "系统配置",
	file: "文件",
	"file-explorer": "文件资源管理器",
	translation: "翻译",
};

/** 动作中文名映射 */
export const ACTION_LABELS: Record<string, string> = {
	create: "创建",
	update: "更新",
	delete: "删除",
	change_status: "状态变更",
	reset_pwd: "重置密码",
	export: "导出",
	import: "导入",
	upload: "上传",
	make_permanent: "转为永久",
	login: "登录",
	request: "外部请求",
};
