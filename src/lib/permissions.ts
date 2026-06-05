/**
 * 权限码常量定义及元数据
 * 格式：{模块}:{操作}
 */
export const PERMISSIONS = {
	// 新闻管理
	NEWS_VIEW: "news:view",
	NEWS_CREATE: "news:create",
	NEWS_EDIT: "news:edit",
	NEWS_DELETE: "news:delete",
	NEWS_PUBLISH: "news:publish",
	// 管理员管理
	ADMIN_VIEW: "admin:view",
	ADMIN_CREATE: "admin:create",
	ADMIN_EDIT: "admin:edit",
	ADMIN_DELETE: "admin:delete",
	// 客户端用户管理
	CLIENT_VIEW: "client:view",
	// 角色管理
	ROLE_VIEW: "role:view",
	ROLE_CREATE: "role:create",
	ROLE_EDIT: "role:edit",
	ROLE_DELETE: "role:delete",
	// 字典管理
	DICT_VIEW: "dict:view",
	DICT_CREATE: "dict:create",
	DICT_EDIT: "dict:edit",
	DICT_DELETE: "dict:delete",
	DICT_CREATE_ITEM: "dict:create_item",
	DICT_EDIT_ITEM: "dict:edit_item",
	DICT_DELETE_ITEM: "dict:delete_item",
	// 系统配置管理
	CONFIG_VIEW: "config:view",
	CONFIG_CREATE: "config:create",
	CONFIG_EDIT: "config:edit",
	CONFIG_DELETE: "config:delete",
	// 文件管理
	FILE_VIEW: "file:view",
	FILE_UPLOAD: "file:upload",
	FILE_EDIT: "file:edit",
	FILE_DELETE: "file:delete",
	// 日志管理
	LOG_VIEW: "log:view",
	// 仪表盘
	DASHBOARD_VIEW: "dashboard:view",
} as const;

/** 权限码类型 */
export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** 权限分组 */
export const PERMISSION_GROUPS = {
	NEWS: "新闻管理",
	ADMIN: "管理员管理",
	CLIENT: "客户端用户",
	ROLE: "角色管理",
	DICT: "字典管理",
	CONFIG: "系统配置",
	FILE: "文件管理",
	LOG: "日志管理",
	DASHBOARD: "仪表盘",
} as const;

/** 权限元数据 */
export interface PermissionMeta {
	code: PermissionCode;
	name: string;
	description: string;
	group: string;
}

/** 所有权限码的元数据映射 */
export const PERMISSION_META: Record<PermissionCode, PermissionMeta> = {
	[PERMISSIONS.NEWS_VIEW]: {
		code: PERMISSIONS.NEWS_VIEW,
		name: "查看新闻",
		description: "允许查看新闻列表和详情",
		group: PERMISSION_GROUPS.NEWS,
	},
	[PERMISSIONS.NEWS_CREATE]: {
		code: PERMISSIONS.NEWS_CREATE,
		name: "创建新闻",
		description: "允许创建新的新闻文章",
		group: PERMISSION_GROUPS.NEWS,
	},
	[PERMISSIONS.NEWS_EDIT]: {
		code: PERMISSIONS.NEWS_EDIT,
		name: "编辑新闻",
		description: "允许编辑已有新闻的内容",
		group: PERMISSION_GROUPS.NEWS,
	},
	[PERMISSIONS.NEWS_DELETE]: {
		code: PERMISSIONS.NEWS_DELETE,
		name: "删除新闻",
		description: "允许删除新闻（软删除）",
		group: PERMISSION_GROUPS.NEWS,
	},
	[PERMISSIONS.NEWS_PUBLISH]: {
		code: PERMISSIONS.NEWS_PUBLISH,
		name: "发布新闻",
		description: "允许发布、归档等状态变更操作",
		group: PERMISSION_GROUPS.NEWS,
	},
	[PERMISSIONS.ADMIN_VIEW]: {
		code: PERMISSIONS.ADMIN_VIEW,
		name: "查看管理员",
		description: "允许查看管理员列表",
		group: PERMISSION_GROUPS.ADMIN,
	},
	[PERMISSIONS.ADMIN_CREATE]: {
		code: PERMISSIONS.ADMIN_CREATE,
		name: "创建管理员",
		description: "允许创建新的管理员账号",
		group: PERMISSION_GROUPS.ADMIN,
	},
	[PERMISSIONS.ADMIN_EDIT]: {
		code: PERMISSIONS.ADMIN_EDIT,
		name: "编辑管理员",
		description: "允许编辑管理员信息",
		group: PERMISSION_GROUPS.ADMIN,
	},
	[PERMISSIONS.ADMIN_DELETE]: {
		code: PERMISSIONS.ADMIN_DELETE,
		name: "删除管理员",
		description: "允许删除管理员账号",
		group: PERMISSION_GROUPS.ADMIN,
	},
	[PERMISSIONS.CLIENT_VIEW]: {
		code: PERMISSIONS.CLIENT_VIEW,
		name: "查看客户端用户",
		description: "允许查看前台注册用户列表",
		group: PERMISSION_GROUPS.CLIENT,
	},
	[PERMISSIONS.ROLE_VIEW]: {
		code: PERMISSIONS.ROLE_VIEW,
		name: "查看角色",
		description: "允许查看角色列表",
		group: PERMISSION_GROUPS.ROLE,
	},
	[PERMISSIONS.ROLE_CREATE]: {
		code: PERMISSIONS.ROLE_CREATE,
		name: "创建角色",
		description: "允许创建新的角色",
		group: PERMISSION_GROUPS.ROLE,
	},
	[PERMISSIONS.ROLE_EDIT]: {
		code: PERMISSIONS.ROLE_EDIT,
		name: "编辑角色",
		description: "允许编辑角色信息和权限分配",
		group: PERMISSION_GROUPS.ROLE,
	},
	[PERMISSIONS.ROLE_DELETE]: {
		code: PERMISSIONS.ROLE_DELETE,
		name: "删除角色",
		description: "允许删除角色",
		group: PERMISSION_GROUPS.ROLE,
	},
	[PERMISSIONS.DICT_VIEW]: {
		code: PERMISSIONS.DICT_VIEW,
		name: "查看字典",
		description: "允许查看字典类型和条目",
		group: PERMISSION_GROUPS.DICT,
	},
	[PERMISSIONS.DICT_CREATE]: {
		code: PERMISSIONS.DICT_CREATE,
		name: "创建字典",
		description: "允许创建新的字典类型",
		group: PERMISSION_GROUPS.DICT,
	},
	[PERMISSIONS.DICT_EDIT]: {
		code: PERMISSIONS.DICT_EDIT,
		name: "编辑字典",
		description: "允许编辑字典类型信息",
		group: PERMISSION_GROUPS.DICT,
	},
	[PERMISSIONS.DICT_DELETE]: {
		code: PERMISSIONS.DICT_DELETE,
		name: "删除字典",
		description: "允许删除字典类型",
		group: PERMISSION_GROUPS.DICT,
	},
	[PERMISSIONS.DICT_CREATE_ITEM]: {
		code: PERMISSIONS.DICT_CREATE_ITEM,
		name: "创建字典条目",
		description: "允许在字典中新增条目",
		group: PERMISSION_GROUPS.DICT,
	},
	[PERMISSIONS.DICT_EDIT_ITEM]: {
		code: PERMISSIONS.DICT_EDIT_ITEM,
		name: "编辑字典条目",
		description: "允许编辑字典条目内容",
		group: PERMISSION_GROUPS.DICT,
	},
	[PERMISSIONS.DICT_DELETE_ITEM]: {
		code: PERMISSIONS.DICT_DELETE_ITEM,
		name: "删除字典条目",
		description: "允许删除字典条目",
		group: PERMISSION_GROUPS.DICT,
	},
	[PERMISSIONS.CONFIG_VIEW]: {
		code: PERMISSIONS.CONFIG_VIEW,
		name: "查看配置",
		description: "允许查看系统配置项",
		group: PERMISSION_GROUPS.CONFIG,
	},
	[PERMISSIONS.CONFIG_CREATE]: {
		code: PERMISSIONS.CONFIG_CREATE,
		name: "创建配置",
		description: "允许新增系统配置项",
		group: PERMISSION_GROUPS.CONFIG,
	},
	[PERMISSIONS.CONFIG_EDIT]: {
		code: PERMISSIONS.CONFIG_EDIT,
		name: "编辑配置",
		description: "允许修改系统配置项的值",
		group: PERMISSION_GROUPS.CONFIG,
	},
	[PERMISSIONS.CONFIG_DELETE]: {
		code: PERMISSIONS.CONFIG_DELETE,
		name: "删除配置",
		description: "允许删除系统配置项",
		group: PERMISSION_GROUPS.CONFIG,
	},
	[PERMISSIONS.FILE_VIEW]: {
		code: PERMISSIONS.FILE_VIEW,
		name: "查看文件",
		description: "允许查看文件列表",
		group: PERMISSION_GROUPS.FILE,
	},
	[PERMISSIONS.FILE_UPLOAD]: {
		code: PERMISSIONS.FILE_UPLOAD,
		name: "上传文件",
		description: "允许上传新文件",
		group: PERMISSION_GROUPS.FILE,
	},
	[PERMISSIONS.FILE_EDIT]: {
		code: PERMISSIONS.FILE_EDIT,
		name: "编辑文件",
		description: "允许修改文件属性（如转为永久存储）",
		group: PERMISSION_GROUPS.FILE,
	},
	[PERMISSIONS.FILE_DELETE]: {
		code: PERMISSIONS.FILE_DELETE,
		name: "删除文件",
		description: "允许删除文件",
		group: PERMISSION_GROUPS.FILE,
	},
	[PERMISSIONS.LOG_VIEW]: {
		code: PERMISSIONS.LOG_VIEW,
		name: "查看日志",
		description: "允许查询和查看系统日志",
		group: PERMISSION_GROUPS.LOG,
	},
	[PERMISSIONS.DASHBOARD_VIEW]: {
		code: PERMISSIONS.DASHBOARD_VIEW,
		name: "查看仪表盘",
		description: "允许查看管理端首页统计信息",
		group: PERMISSION_GROUPS.DASHBOARD,
	},
};

/** 所有权限码列表 */
export const ALL_PERMISSIONS: PermissionCode[] = Object.values(PERMISSIONS);

/** 按分组归类的权限码列表 */
export const PERMISSIONS_BY_GROUP: Record<string, PermissionMeta[]> =
	Object.values(PERMISSION_META).reduce(
		(acc, meta) => {
			if (!acc[meta.group]) acc[meta.group] = [];
			acc[meta.group].push(meta);
			return acc;
		},
		{} as Record<string, PermissionMeta[]>,
	);

/**
 * 检查角色是否拥有指定权限
 */
export function hasPermission(
	rolePermissions: string[],
	required: PermissionCode,
): boolean {
	return rolePermissions.includes(required);
}

/**
 * 检查角色是否拥有任一权限
 */
export function hasAnyPermission(
	rolePermissions: string[],
	required: PermissionCode[],
): boolean {
	return required.some((p) => rolePermissions.includes(p));
}

/**
 * 检查角色是否拥有全部权限
 */
export function hasAllPermissions(
	rolePermissions: string[],
	required: PermissionCode[],
): boolean {
	return required.every((p) => rolePermissions.includes(p));
}
