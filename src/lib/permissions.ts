/**
 * 权限码常量定义
 * 格式：{模块}:{操作}
 */
export const PERMISSIONS = {
	// 新闻
	NEWS_VIEW: "news:view",
	NEWS_CREATE: "news:create",
	NEWS_EDIT: "news:edit",
	NEWS_DELETE: "news:delete",
	// 管理员
	ADMIN_VIEW: "admin:view",
	ADMIN_CREATE: "admin:create",
	ADMIN_EDIT: "admin:edit",
	ADMIN_DELETE: "admin:delete",
	// 客户端用户
	CLIENT_VIEW: "client:view",
	// 角色
	ROLE_VIEW: "role:view",
	ROLE_CREATE: "role:create",
	ROLE_EDIT: "role:edit",
	ROLE_DELETE: "role:delete",
	// 字典
	DICT_VIEW: "dict:view",
	DICT_EDIT: "dict:edit",
	// 系统配置
	CONFIG_VIEW: "config:view",
	CONFIG_EDIT: "config:edit",
	// 文件
	FILE_VIEW: "file:view",
	FILE_UPLOAD: "file:upload",
	FILE_DELETE: "file:delete",
	// 日志
	LOG_VIEW: "log:view",
	// 仪表盘
	DASHBOARD_VIEW: "dashboard:view",
} as const;

/** 权限码类型 */
export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** 所有权限码列表 */
export const ALL_PERMISSIONS: PermissionCode[] = Object.values(PERMISSIONS);

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
